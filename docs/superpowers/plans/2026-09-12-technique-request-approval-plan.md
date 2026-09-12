# 기술 등록/수정 요청 승인 워크플로우 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 일반 계정이 기술 등록/수정을 "요청"할 수 있게 하고, 관리자가 요청 목록에서 검토 후 승인/반려할 수 있게 하며, 처리 결과와 신규 요청 도착을 인앱 알림으로 전달한다.

**Architecture:** 신규 `TechniqueRequest` 컬렉션에 제출된(화이트리스트로 필터링된) payload를 저장하고, 승인 시점에만 라이브 `Technique` 컬렉션에 반영한다. 신규 `Notification` 컬렉션으로 제출자/관리자에게 인앱 알림을 전달한다. 기존에 `POST/PUT /api/techniques*`에 있던 slug 생성·부모-자식 갱신 로직을 `src/lib/technique-service.ts`로 추출해 관리자 직접 라우트와 승인 라우트가 함께 쓴다.

**Tech Stack:** Next.js 16 App Router, Mongoose, NextAuth (credentials), TypeScript, Tailwind.

**스펙 문서:** `docs/superpowers/specs/2026-09-12-technique-request-approval-design.md`

---

## 테스트 방식에 대한 참고

이 프로젝트에는 자동화된 테스트 러너가 전혀 설치되어 있지 않다(`package.json`에 jest/vitest 없음, 기존 API 라우트 중 테스트가 있는 것도 없음). 기존 관례를 따라 이 계획도 자동 테스트 대신, 각 작업마다 **구체적인 수동 검증 절차**(브라우저 조작 또는 브라우저 콘솔에서의 `fetch()` 호출 + MongoDB 상태 확인)를 사용한다.

**공통 준비물:**

1. 개발 서버를 `NEXTAUTH_URL`(=`http://localhost:3001`)과 맞춰 실행한다:
   ```bash
   npm run dev -- -p 3001
   ```
2. 테스트 계정 두 개를 `http://localhost:3001/auth/signup`에서 만든다:
   - **관리자 계정**: 이메일을 `.env.local`의 `ADMIN_EMAIL` 값과 동일하게 입력(자동으로 `role: 'admin'` 부여됨), 비밀번호 8자 이상, 닉네임 아무거나.
   - **일반 계정**: 다른 이메일(예: `test-user@example.com`), 비밀번호 8자 이상, 닉네임 아무거나(예: `테스트유저`).
   - 이미 계정이 있다면 재사용해도 된다.
3. MongoDB 상태를 확인할 때 쓰는 헬퍼 (프로젝트 루트에서 실행):
   ```bash
   export MONGODB_URI=$(grep '^MONGODB_URI=' .env.local | cut -d '=' -f2-)
   mongosh "$MONGODB_URI" --quiet --eval "<여기에 쿼리>"
   ```
4. 로그인된 브라우저 탭에서 API를 직접 호출해야 하는 작업(아직 UI가 없는 단계)은, 그 계정으로 로그인한 상태에서 브라우저 개발자 도구 콘솔에 `fetch(...)` 스니펫을 실행해 세션 쿠키가 자동으로 실리도록 한다. 각 작업의 검증 절차에 정확한 스니펫을 적어둔다.

---

### Task 1: `requireAuth` 헬퍼 추가 + `/api/upload`를 로그인 사용자에게 개방

일반 계정이 기술 등록/수정 요청 폼에서 썸네일을 올리려면 업로드 API가 admin 전용이면 안 된다.

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/app/api/upload/route.ts`

- [ ] **Step 1: `requireAuth` 헬퍼 추가**

`src/lib/auth.ts`의 `requireAdmin` 함수 바로 아래에 다음 함수를 추가한다:

```ts
export async function requireAuth(): Promise<{ session: Session | null; error: NextResponse | null }> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { session, error: null };
}
```

- [ ] **Step 2: `/api/upload`가 `requireAuth`를 쓰도록 변경**

`src/app/api/upload/route.ts`에서:

```diff
-import { requireAdmin } from '@/lib/auth';
+import { requireAuth } from '@/lib/auth';
```

```diff
-    const { session, error: authError } = await requireAdmin();
+    const { session, error: authError } = await requireAuth();
```

나머지 로직(`uploaderType = session!.user.role`)은 그대로 둔다. `Image` 모델의 `uploaderType` enum이 이미 `'admin' | 'user'`이고 `session.user.role`도 정확히 그 두 값이므로 수정할 필요가 없다.

- [ ] **Step 3: 검증**

개발 서버를 띄운 뒤, **일반 계정**으로 `http://localhost:3001`에 로그인한 브라우저 탭에서 개발자 도구 콘솔에 다음을 실행한다:

```js
const fd = new FormData();
fd.append('file', new Blob(['test'], { type: 'text/plain' }), 'test.txt');
fd.append('usage', 'technique_thumbnail');
const res = await fetch('/api/upload', { method: 'POST', body: fd });
console.log(res.status, await res.json());
```

기대 결과: 이전에는 `403 Forbidden`이었던 것이 이제 Cloudinary 업로드 로직까지 도달한다(파일 타입이 이미지가 아니라 Cloudinary가 에러를 낼 수도 있지만, 최소한 `401`/`403`이 아니라 `500`이거나 성공이어야 한다 — 즉 인증 단계는 통과했다는 뜻). 같은 스니펫을 실제 이미지 파일로 테스트하려면 `<input type=file>`을 페이지에서 찾아 파일을 선택한 뒤 `fd.append('file', input.files[0])`로 바꿔 실행한다. 성공 시 `{ success: true, data: { url, imageId } }`가 반환된다.

- [ ] **Step 4: 커밋**

```bash
git add src/lib/auth.ts src/app/api/upload/route.ts
git commit -m "$(cat <<'EOF'
Allow authenticated non-admin users to upload images

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 기술 생성/수정 로직을 `technique-service.ts`로 추출

승인 라우트(Task 7, 8)가 관리자 직접 라우트와 동일한 slug 생성 / 부모-자식 갱신 로직을 재사용하도록 미리 추출한다. 이 작업은 **동작을 바꾸지 않는 리팩터링**이며, 기존 admin 플로우가 그대로 동작하는지 검증하는 것이 핵심이다.

**Files:**
- Modify: `src/lib/technique-service.ts`
- Modify: `src/app/api/techniques/route.ts`
- Modify: `src/app/api/techniques/[id]/route.ts`

- [ ] **Step 1: `technique-service.ts`에 공유 함수 추가**

기존 `getTechniqueTree` 아래에 다음을 추가한다 (`src/lib/technique-service.ts` 전체 내용은 아래와 같이 된다):

```ts
import dbConnect from '@/lib/db';
import Technique, { ITechnique } from '@/models/Technique';
import { unstable_cache } from 'next/cache';

export const getTechniqueTree = unstable_cache(
  async () => {
    await dbConnect();

    // Fetch only necessary fields for the sidebar
    const techniques = await Technique.find({ status: 'published' })
      .select('_id name slug parentId pathSlugs order level')
      .sort({ order: 1, 'name.ko': 1 })
      .lean();

    // Convert _id and parentId to string to avoid serialization issues
    const plainTechniques = techniques.map(tech => ({
      ...tech,
      _id: tech._id.toString(),
      parentId: tech.parentId ? tech.parentId.toString() : null,
      children: [] as any[], // Initialize children array
    }));

    // Build tree
    const map = new Map<string, any>();
    const roots: any[] = [];

    // First pass: create nodes map
    plainTechniques.forEach(item => {
      map.set(item._id, item);
    });

    // Second pass: link children
    plainTechniques.forEach(item => {
      if (item.parentId && map.has(item.parentId)) {
        map.get(item.parentId).children.push(item);
      } else {
        roots.push(item);
      }
    });

    console.log(`[getTechniqueTree] Total: ${plainTechniques.length}, Roots: ${roots.length}`);
    return roots;
  },
  ['technique-tree'],
  { revalidate: 3600, tags: ['technique-tree'] }
);

// 일반 계정의 등록/수정 요청 payload에서 허용할 필드 목록.
// TechniqueRequest 승인 시 이 필드 밖의 값(status, order, viewCount, createdBy 등)은
// 절대 라이브 데이터에 반영되지 않는다.
export const EDITABLE_TECHNIQUE_FIELDS = [
  'name',
  'aka',
  'description',
  'type',
  'primaryRole',
  'roleTags',
  'difficulty',
  'isCorePosition',
  'positionType',
  'parentId',
  'videos',
  'images',
  'thumbnailUrl',
] as const;

export function pickTechniquePayload(body: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const field of EDITABLE_TECHNIQUE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      picked[field] = body[field];
    }
  }
  return picked;
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-');  // Replace multiple - with single -
}

export async function createTechniqueFromPayload(payload: Record<string, unknown>): Promise<ITechnique> {
  await dbConnect();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = { ...payload };

  // 1. Generate Slug if not provided
  if (!body.slug) {
    const nameForSlug = body.name?.en || body.name?.ko || 'untitled';
    let generatedSlug = slugify(nameForSlug);

    let counter = 1;
    while (await Technique.findOne({ slug: generatedSlug })) {
      generatedSlug = `${slugify(nameForSlug)}-${counter}`;
      counter++;
    }
    body.slug = generatedSlug;
  }

  // 2. Handle Hierarchy
  if (body.parentId) {
    const parent = await Technique.findById(body.parentId);
    if (!parent) {
      throw new Error('Parent technique not found');
    }
    body.level = (parent.level || 1) + 1;
    body.pathSlugs = [...(parent.pathSlugs || []), parent.slug];
  } else {
    body.level = 1;
    body.pathSlugs = [];
  }

  // 3. Create Technique
  const technique = (await Technique.create({
    ...body,
    status: body.status || 'draft',
  })) as unknown as ITechnique;

  // 4. Update Parent's childrenIds
  if (body.parentId) {
    await Technique.findByIdAndUpdate(body.parentId, {
      $push: { childrenIds: technique._id },
    });
  }

  return technique;
}

export async function applyTechniqueEdit(
  id: string,
  payload: Record<string, unknown>
): Promise<ITechnique | null> {
  await dbConnect();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = { ...payload };

  const currentTechnique = await Technique.findById(id);
  if (!currentTechnique) {
    return null;
  }

  // Handle Parent Change
  if (body.parentId && body.parentId !== currentTechnique.parentId?.toString()) {
    if (currentTechnique.parentId) {
      await Technique.findByIdAndUpdate(currentTechnique.parentId, {
        $pull: { childrenIds: id },
      });
    }

    const newParent = await Technique.findById(body.parentId);
    if (newParent) {
      await Technique.findByIdAndUpdate(body.parentId, {
        $push: { childrenIds: id },
      });
      body.level = (newParent.level || 1) + 1;
      body.pathSlugs = [...(newParent.pathSlugs || []), newParent.slug];
    }
  } else if (body.parentId === null && currentTechnique.parentId) {
    await Technique.findByIdAndUpdate(currentTechnique.parentId, {
      $pull: { childrenIds: id },
    });
    body.level = 1;
    body.pathSlugs = [];
  }

  const technique = await Technique.findByIdAndUpdate(id, body, {
    new: true,
    runValidators: true,
  });

  return technique;
}
```

- [ ] **Step 2: `POST /api/techniques`가 `createTechniqueFromPayload`를 쓰도록 변경**

`src/app/api/techniques/route.ts`의 상단 import와 `slugify` 함수, `POST` 함수 전체를 다음으로 교체한다 (`GET` 함수는 그대로 둔다):

```ts
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';
import rateLimit from '@/lib/rate-limit';
import mongoose from 'mongoose';
import { requireAdmin } from '@/lib/auth';
import { createTechniqueFromPayload } from '@/lib/technique-service';

const limiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  uniqueTokenPerInterval: 500, // Max 500 users per second
});
```

(`slugify` 함수 선언은 삭제한다 — `technique-service.ts`로 옮겨졌다.)

`POST` 함수 본문 전체를 다음으로 교체:

```ts
export async function POST(request: Request) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

    try {
      await limiter.check(10, ip); // 10 requests per minute per IP
    } catch {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const technique = await createTechniqueFromPayload({
      ...body,
      status: body.status || 'draft',
    });

    return NextResponse.json({ success: true, data: technique }, { status: 201 });
  } catch (error: unknown) {
    console.error('POST Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create technique';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 3: `PUT /api/techniques/[id]`가 `applyTechniqueEdit`을 쓰도록 변경**

`src/app/api/techniques/[id]/route.ts`의 최상단 import에 추가:

```diff
 import { requireAdmin } from '@/lib/auth';
+import { applyTechniqueEdit } from '@/lib/technique-service';
```

`PUT` 함수 본문 전체를 다음으로 교체 (`GET`, `DELETE`는 그대로 둔다):

```ts
export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const body = await request.json();
    const technique = await applyTechniqueEdit(params.id, body);

    if (!technique) {
      return NextResponse.json(
        { success: false, error: 'Technique not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: technique });
  } catch (error) {
    console.error('PUT Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update technique' },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 4: 타입체크**

```bash
npx tsc --noEmit
```

기대 결과: 에러 없음. (`route.ts`에서 이제 쓰이지 않는 `ITechnique` import가 있다면 `import Technique from '@/models/Technique';`로 단순화한다 — `tsc`가 unused import를 에러로 잡지는 않지만 `eslint`가 경고할 수 있으므로 `npm run lint`도 함께 돌려 정리한다.)

- [ ] **Step 5: 검증 — 기존 admin 플로우가 그대로 동작하는지 확인**

**관리자 계정**으로 로그인한 브라우저에서 `http://localhost:3001/technique/new`로 이동해 기술을 하나 등록해본다(이름: "리팩터링테스트기술"). 등록 후 해당 기술 상세 페이지로 리다이렉트되고, 상세 페이지에서 "수정" 버튼으로 설명을 바꿔 저장해본다. 두 동작 모두 이전과 동일하게 즉시 반영되어야 한다.

DB에서도 확인:

```bash
mongosh "$MONGODB_URI" --quiet --eval "db.techniques.findOne({'name.ko': '리팩터링테스트기술'}, {name:1, status:1, slug:1})"
```

기대 결과: `status: 'published'`인 문서가 존재.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/technique-service.ts src/app/api/techniques/route.ts src/app/api/techniques/[id]/route.ts
git commit -m "$(cat <<'EOF'
Extract technique create/edit logic into technique-service

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `TechniqueRequest` 모델

**Files:**
- Create: `src/models/TechniqueRequest.ts`

- [ ] **Step 1: 모델 작성**

```ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export type TechniqueRequestType = 'create' | 'edit';
export type TechniqueRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ITechniqueRequest extends Document {
  type: TechniqueRequestType;
  targetTechniqueId?: mongoose.Types.ObjectId | null;
  payload: Record<string, unknown>;
  status: TechniqueRequestStatus;
  submittedBy: mongoose.Types.ObjectId;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TechniqueRequestSchema: Schema = new Schema(
  {
    type: { type: String, enum: ['create', 'edit'], required: true },
    targetTechniqueId: { type: Schema.Types.ObjectId, ref: 'Technique', default: null, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewNote: { type: String },
  },
  { timestamps: true }
);

TechniqueRequestSchema.index({ status: 1, createdAt: -1 });

const TechniqueRequest: Model<ITechniqueRequest> =
  mongoose.models.TechniqueRequest ||
  mongoose.model<ITechniqueRequest>('TechniqueRequest', TechniqueRequestSchema);

export default TechniqueRequest;
```

- [ ] **Step 2: 타입체크**

```bash
npx tsc --noEmit
```

기대 결과: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/models/TechniqueRequest.ts
git commit -m "$(cat <<'EOF'
Add TechniqueRequest model for the approval workflow

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `Notification` 모델

**Files:**
- Create: `src/models/Notification.ts`

- [ ] **Step 1: 모델 작성**

```ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export type NotificationType = 'request_approved' | 'request_rejected' | 'new_request';

export interface INotification extends Document {
  user: mongoose.Types.ObjectId;
  type: NotificationType;
  message: string;
  relatedRequestId?: mongoose.Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['request_approved', 'request_rejected', 'new_request'],
      required: true,
    },
    message: { type: String, required: true },
    relatedRequestId: { type: Schema.Types.ObjectId, ref: 'TechniqueRequest' },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

NotificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
```

- [ ] **Step 2: 타입체크**

```bash
npx tsc --noEmit
```

기대 결과: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/models/Notification.ts
git commit -m "$(cat <<'EOF'
Add Notification model for in-app notifications

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `POST` / `GET /api/technique-requests`

로그인 사용자가 요청을 제출하고(`POST`), 본인 요청 또는(관리자면) 전체 요청을 조회한다(`GET`).

**Files:**
- Create: `src/app/api/technique-requests/route.ts`

- [ ] **Step 1: 라우트 작성**

```ts
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import TechniqueRequest from '@/models/TechniqueRequest';
import Technique from '@/models/Technique';
import User from '@/models/User';
import Notification from '@/models/Notification';
import { requireAuth } from '@/lib/auth';
import { pickTechniquePayload } from '@/lib/technique-service';
import rateLimit from '@/lib/rate-limit';

const limiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});

export async function POST(request: Request) {
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    try {
      await limiter.check(5, session!.user.id);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    await dbConnect();
    const body = await request.json();

    if (body.type !== 'create' && body.type !== 'edit') {
      return NextResponse.json(
        { success: false, error: 'type must be "create" or "edit"' },
        { status: 400 }
      );
    }

    let targetTechniqueId: string | null = null;

    if (body.type === 'edit') {
      if (!body.targetTechniqueId || !mongoose.isValidObjectId(body.targetTechniqueId)) {
        return NextResponse.json(
          { success: false, error: 'targetTechniqueId is required for edit requests' },
          { status: 400 }
        );
      }

      const target = await Technique.findById(body.targetTechniqueId);
      if (!target) {
        return NextResponse.json(
          { success: false, error: 'Target technique not found' },
          { status: 404 }
        );
      }

      const duplicate = await TechniqueRequest.findOne({
        type: 'edit',
        targetTechniqueId: body.targetTechniqueId,
        submittedBy: session!.user.id,
        status: 'pending',
      });
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: '이미 이 기술에 대한 대기 중인 수정 요청이 있습니다.' },
          { status: 409 }
        );
      }

      targetTechniqueId = body.targetTechniqueId;
    }

    const payload = pickTechniquePayload(body.payload || {});
    if (Object.keys(payload).length === 0) {
      return NextResponse.json(
        { success: false, error: 'payload is empty' },
        { status: 400 }
      );
    }

    const techniqueRequest = await TechniqueRequest.create({
      type: body.type,
      targetTechniqueId,
      payload,
      status: 'pending',
      submittedBy: new mongoose.Types.ObjectId(session!.user.id),
    });

    const admins = await User.find({ role: 'admin' }).select('_id');
    if (admins.length > 0) {
      await Notification.insertMany(
        admins.map((admin) => ({
          user: admin._id,
          type: 'new_request' as const,
          message:
            body.type === 'create'
              ? '새로운 기술 등록 요청이 도착했습니다.'
              : '새로운 기술 수정 요청이 도착했습니다.',
          relatedRequestId: techniqueRequest._id,
          isRead: false,
        }))
      );
    }

    return NextResponse.json({ success: true, data: techniqueRequest }, { status: 201 });
  } catch (error) {
    console.error('POST /api/technique-requests error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit request' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    await dbConnect();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const mine = searchParams.get('mine');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {};
    if (status) query.status = status;

    if (session!.user.role !== 'admin' || mine === '1') {
      query.submittedBy = session!.user.id;
    }

    const requests = await TechniqueRequest.find(query)
      .sort({ createdAt: -1 })
      .populate('submittedBy', 'nickname email')
      .populate('targetTechniqueId', 'name slug pathSlugs')
      .populate('reviewedBy', 'nickname');

    return NextResponse.json({ success: true, data: requests });
  } catch (error) {
    console.error('GET /api/technique-requests error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 검증 — 신규 등록 요청 제출**

**일반 계정**으로 로그인한 브라우저 콘솔에서:

```js
const res = await fetch('/api/technique-requests', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'create',
    payload: {
      name: { ko: '테스트요청기술' },
      description: { ko: '요청 테스트용 설명' },
      type: 'both',
      primaryRole: 'position',
    },
  }),
});
console.log(res.status, await res.json());
```

기대 결과: `201`과 함께 `status: 'pending'`인 문서가 반환된다.

같은 콘솔에서 목록도 확인:

```js
const res2 = await fetch('/api/technique-requests?mine=1');
console.log(res2.status, await res2.json());
```

기대 결과: 방금 만든 요청 1건이 포함된 배열.

DB로도 확인:

```bash
mongosh "$MONGODB_URI" --quiet --eval "db.techniquerequests.find({}).sort({createdAt:-1}).limit(1).pretty()"
```

- [ ] **Step 3: 검증 — 화이트리스트 밖 필드는 저장되지 않는지 확인**

같은 계정으로:

```js
const res = await fetch('/api/technique-requests', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'create',
    payload: {
      name: { ko: '권한상승테스트' },
      status: 'published',
      viewCount: 999999,
      order: -1,
    },
  }),
});
const data = await res.json();
console.log(data.data.payload);
```

기대 결과: 출력된 `payload`에 `name`만 있고 `status`, `viewCount`, `order`는 없어야 한다.

- [ ] **Step 4: 검증 — 같은 기술에 대한 중복 대기 요청 차단**

Step 2와 같은 계정으로, 이번엔 기존 published 기술 하나를 대상으로 수정 요청을 두 번 연달아 제출한다:

```js
const targetId = '<임의의 published technique _id>'; // GET /api/techniques?status=published 로 확인
const body = JSON.stringify({
  type: 'edit',
  targetTechniqueId: targetId,
  payload: { name: { ko: '중복테스트' } },
});

const first = await fetch('/api/technique-requests', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body,
});
console.log('first:', first.status, await first.json());

const second = await fetch('/api/technique-requests', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body,
});
console.log('second:', second.status, await second.json());
```

기대 결과: `first`는 `201`, `second`는 `409`(이미 대기 중인 수정 요청이 있다는 에러 메시지).

- [ ] **Step 5: 검증 — 관리자 알림 생성 확인**

Step 2에서 요청을 제출한 직후, **관리자 계정**의 `_id`를 알아내 알림이 생겼는지 확인한다:

```bash
mongosh "$MONGODB_URI" --quiet --eval "
  const admin = db.users.findOne({role: 'admin'});
  printjson(db.notifications.find({user: admin._id, type: 'new_request'}).sort({createdAt:-1}).limit(1).toArray())
"
```

기대 결과: `new_request` 타입의 안읽음 알림이 존재.

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/technique-requests/route.ts
git commit -m "$(cat <<'EOF'
Add technique-requests submit and list API

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `GET /api/technique-requests/[id]`

관리자 또는 본인 제출자만 단건 조회 가능. 관리자 검토 화면(Task 11)이 이 응답의 `targetTechniqueId`(전체 populate된 현재 기술 데이터)를 diff 기준으로 사용한다.

**Files:**
- Create: `src/app/api/technique-requests/[id]/route.ts`

- [ ] **Step 1: 라우트 작성**

```ts
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import TechniqueRequest from '@/models/TechniqueRequest';
import { requireAuth } from '@/lib/auth';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request id' },
        { status: 400 }
      );
    }

    await dbConnect();

    const techniqueRequest = await TechniqueRequest.findById(params.id)
      .populate('submittedBy', 'nickname email')
      .populate('reviewedBy', 'nickname')
      .populate('targetTechniqueId');

    if (!techniqueRequest) {
      return NextResponse.json(
        { success: false, error: 'Request not found' },
        { status: 404 }
      );
    }

    const submittedBy = techniqueRequest.submittedBy as unknown as { _id: mongoose.Types.ObjectId };
    const isOwner = submittedBy._id.toString() === session!.user.id;
    if (session!.user.role !== 'admin' && !isOwner) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: techniqueRequest });
  } catch (error) {
    console.error('GET /api/technique-requests/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch request' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 검증**

Task 5에서 만든 요청의 `_id`를 이용해, **같은 일반 계정**의 브라우저 콘솔에서:

```js
const res = await fetch('/api/technique-requests/<위에서 얻은 _id>');
console.log(res.status, await res.json());
```

기대 결과: `200`과 본인 요청 데이터.

이제 **다른 일반 계정**(또는 로그아웃 후 새 계정으로 로그인)의 브라우저에서 같은 요청을 시도:

기대 결과: `403 Forbidden`.

**관리자 계정**으로는 `200`이 나와야 한다.

- [ ] **Step 3: 커밋**

```bash
git add "src/app/api/technique-requests/[id]/route.ts"
git commit -m "$(cat <<'EOF'
Add single technique-request fetch with ownership check

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `POST /api/technique-requests/[id]/approve`

**Files:**
- Create: `src/app/api/technique-requests/[id]/approve/route.ts`

- [ ] **Step 1: 라우트 작성**

```ts
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import TechniqueRequest from '@/models/TechniqueRequest';
import Notification from '@/models/Notification';
import { requireAdmin } from '@/lib/auth';
import { createTechniqueFromPayload, applyTechniqueEdit } from '@/lib/technique-service';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const { session, error: authError } = await requireAdmin();
    if (authError) return authError;

    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request id' },
        { status: 400 }
      );
    }

    await dbConnect();

    const techniqueRequest = await TechniqueRequest.findById(params.id);
    if (!techniqueRequest) {
      return NextResponse.json(
        { success: false, error: 'Request not found' },
        { status: 404 }
      );
    }
    if (techniqueRequest.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Request is not pending' },
        { status: 409 }
      );
    }

    if (techniqueRequest.type === 'create') {
      await createTechniqueFromPayload({
        ...techniqueRequest.payload,
        status: 'published',
      });
    } else {
      const targetId = techniqueRequest.targetTechniqueId?.toString();
      if (!targetId) {
        return NextResponse.json(
          { success: false, error: 'Missing target technique' },
          { status: 400 }
        );
      }

      const updated = await applyTechniqueEdit(targetId, techniqueRequest.payload);
      if (!updated) {
        // 대상 기술이 그 사이 삭제된 경우: 승인 대신 자동 반려 처리
        techniqueRequest.status = 'rejected';
        techniqueRequest.reviewedBy = new mongoose.Types.ObjectId(session!.user.id);
        techniqueRequest.reviewNote = '대상 기술이 삭제되어 자동으로 반려되었습니다.';
        await techniqueRequest.save();

        await Notification.create({
          user: techniqueRequest.submittedBy,
          type: 'request_rejected',
          message: `수정 요청이 반려되었습니다: ${techniqueRequest.reviewNote}`,
          relatedRequestId: techniqueRequest._id,
          isRead: false,
        });

        await Notification.updateMany(
          { relatedRequestId: techniqueRequest._id, type: 'new_request', isRead: false },
          { $set: { isRead: true } }
        );

        return NextResponse.json(
          { success: false, error: techniqueRequest.reviewNote },
          { status: 409 }
        );
      }
    }

    techniqueRequest.status = 'approved';
    techniqueRequest.reviewedBy = new mongoose.Types.ObjectId(session!.user.id);
    await techniqueRequest.save();

    await Notification.create({
      user: techniqueRequest.submittedBy,
      type: 'request_approved',
      message:
        techniqueRequest.type === 'create'
          ? '등록 요청하신 기술이 승인되어 게시되었습니다.'
          : '수정 요청하신 내용이 승인되어 반영되었습니다.',
      relatedRequestId: techniqueRequest._id,
      isRead: false,
    });

    // 다른 관리자들에게 갔던 "새 요청" 알림도 함께 읽음 처리 (안 그러면 벨이 계속 켜져 있음)
    await Notification.updateMany(
      { relatedRequestId: techniqueRequest._id, type: 'new_request', isRead: false },
      { $set: { isRead: true } }
    );

    return NextResponse.json({ success: true, data: techniqueRequest });
  } catch (error) {
    console.error('POST /api/technique-requests/[id]/approve error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve request' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 검증 — 신규 등록 요청 승인**

Task 5에서 만든 `테스트요청기술` 요청의 `_id`로, **관리자 계정** 브라우저 콘솔에서:

```js
const res = await fetch('/api/technique-requests/<request _id>/approve', { method: 'POST' });
console.log(res.status, await res.json());
```

기대 결과: `200`, `data.status === 'approved'`.

```bash
mongosh "$MONGODB_URI" --quiet --eval "db.techniques.findOne({'name.ko': '테스트요청기술'}, {status:1, slug:1})"
```

기대 결과: `status: 'published'`인 문서가 새로 생성되어 있음.

같은 요청에 다시 승인을 시도:

```js
const res = await fetch('/api/technique-requests/<request _id>/approve', { method: 'POST' });
console.log(res.status, await res.json());
```

기대 결과: `409` (`Request is not pending`).

- [ ] **Step 3: 검증 — 수정 요청 승인 + 필드 부분 반영 확인**

관리자 계정으로 아무 기존 published 기술의 `_id`를 하나 얻은 뒤(`fetch('/api/techniques?status=published').then(r=>r.json())`), **일반 계정**으로 전환해 그 기술에 대한 수정 요청을 제출한다(name만 바꿔서):

```js
const res = await fetch('/api/technique-requests', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'edit',
    targetTechniqueId: '<대상 technique _id>',
    payload: { name: { ko: '이름만바뀜' } },
  }),
});
const created = await res.json();
console.log(created);
```

**관리자 계정**으로 전환해 승인:

```js
const res = await fetch(`/api/technique-requests/${created.data._id}/approve`, { method: 'POST' });
console.log(res.status, await res.json());
```

DB에서 확인:

```bash
mongosh "$MONGODB_URI" --quiet --eval "db.techniques.findOne({_id: ObjectId('<대상 technique _id>')}, {name:1, description:1, difficulty:1})"
```

기대 결과: `name.ko`만 `'이름만바뀜'`으로 바뀌고 `description`, `difficulty` 등 payload에 없던 필드는 원래 값 그대로 유지되어 있어야 한다 (이것이 "제출된 키만 `$set`" 요구사항의 핵심 검증 포인트).

- [ ] **Step 4: 검증 — 삭제된 대상 기술에 대한 자동 반려**

관리자 계정으로 테스트용 기술을 하나 만들고, 그 기술에 대해 일반 계정으로 수정 요청을 제출한다. 그다음 관리자 계정으로 `DELETE /api/techniques/<id>`를 호출해 대상 기술을 삭제한다. 마지막으로 그 수정 요청을 승인 시도:

```js
const res = await fetch(`/api/technique-requests/${editRequestId}/approve`, { method: 'POST' });
console.log(res.status, await res.json());
```

기대 결과: `409`, 에러 메시지에 "대상 기술이 삭제되어" 포함. DB 확인 시 해당 요청의 `status`가 `'rejected'`로 바뀌어 있어야 한다.

- [ ] **Step 5: 커밋**

```bash
git add "src/app/api/technique-requests/[id]/approve/route.ts"
git commit -m "$(cat <<'EOF'
Add technique-request approve endpoint

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `POST /api/technique-requests/[id]/reject`

**Files:**
- Create: `src/app/api/technique-requests/[id]/reject/route.ts`

- [ ] **Step 1: 라우트 작성**

```ts
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import TechniqueRequest from '@/models/TechniqueRequest';
import Notification from '@/models/Notification';
import { requireAdmin } from '@/lib/auth';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const { session, error: authError } = await requireAdmin();
    if (authError) return authError;

    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request id' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const reviewNote = typeof body.reviewNote === 'string' ? body.reviewNote.trim() : '';
    if (!reviewNote) {
      return NextResponse.json(
        { success: false, error: 'reviewNote is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    const techniqueRequest = await TechniqueRequest.findById(params.id);
    if (!techniqueRequest) {
      return NextResponse.json(
        { success: false, error: 'Request not found' },
        { status: 404 }
      );
    }
    if (techniqueRequest.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Request is not pending' },
        { status: 409 }
      );
    }

    techniqueRequest.status = 'rejected';
    techniqueRequest.reviewedBy = new mongoose.Types.ObjectId(session!.user.id);
    techniqueRequest.reviewNote = reviewNote;
    await techniqueRequest.save();

    await Notification.create({
      user: techniqueRequest.submittedBy,
      type: 'request_rejected',
      message: `요청이 반려되었습니다: ${reviewNote}`,
      relatedRequestId: techniqueRequest._id,
      isRead: false,
    });

    await Notification.updateMany(
      { relatedRequestId: techniqueRequest._id, type: 'new_request', isRead: false },
      { $set: { isRead: true } }
    );

    return NextResponse.json({ success: true, data: techniqueRequest });
  } catch (error) {
    console.error('POST /api/technique-requests/[id]/reject error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reject request' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 검증 — 사유 없이 반려 시도**

새로 요청 하나를 제출한 뒤(Task 5의 스니펫 재사용), **관리자 계정**에서:

```js
const res = await fetch(`/api/technique-requests/${requestId}/reject`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
});
console.log(res.status, await res.json());
```

기대 결과: `400` (`reviewNote is required`).

- [ ] **Step 3: 검증 — 사유와 함께 반려**

```js
const res = await fetch(`/api/technique-requests/${requestId}/reject`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ reviewNote: '설명이 너무 짧습니다.' }),
});
console.log(res.status, await res.json());
```

기대 결과: `200`, `data.status === 'rejected'`, `data.reviewNote === '설명이 너무 짧습니다.'`.

**제출자였던 일반 계정**으로 전환해 알림을 확인:

```bash
mongosh "$MONGODB_URI" --quiet --eval "db.notifications.find({type: 'request_rejected'}).sort({createdAt:-1}).limit(1).pretty()"
```

기대 결과: 사유가 포함된 메시지의 알림 존재.

- [ ] **Step 4: 커밋**

```bash
git add "src/app/api/technique-requests/[id]/reject/route.ts"
git commit -m "$(cat <<'EOF'
Add technique-request reject endpoint with required review note

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: 알림 API (`/api/notifications*`)

**Files:**
- Create: `src/app/api/notifications/route.ts`
- Create: `src/app/api/notifications/[id]/read/route.ts`
- Create: `src/app/api/notifications/read-all/route.ts`

- [ ] **Step 1: 목록 조회**

`src/app/api/notifications/route.ts`:

```ts
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Notification from '@/models/Notification';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    await dbConnect();

    const notifications = await Notification.find({ user: session!.user.id })
      .sort({ createdAt: -1 })
      .limit(30);

    const unreadCount = await Notification.countDocuments({
      user: session!.user.id,
      isRead: false,
    });

    return NextResponse.json({ success: true, data: { notifications, unreadCount } });
  } catch (error) {
    console.error('GET /api/notifications error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 단건 읽음 처리**

`src/app/api/notifications/[id]/read/route.ts`:

```ts
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Notification from '@/models/Notification';
import { requireAuth } from '@/lib/auth';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid notification id' },
        { status: 400 }
      );
    }

    await dbConnect();

    const notification = await Notification.findOneAndUpdate(
      { _id: params.id, user: session!.user.id },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notification) {
      return NextResponse.json(
        { success: false, error: 'Notification not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: notification });
  } catch (error) {
    console.error('POST /api/notifications/[id]/read error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: 전체 읽음 처리**

`src/app/api/notifications/read-all/route.ts`:

```ts
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Notification from '@/models/Notification';
import { requireAuth } from '@/lib/auth';

export async function POST() {
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    await dbConnect();

    await Notification.updateMany(
      { user: session!.user.id, isRead: false },
      { $set: { isRead: true } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/notifications/read-all error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update notifications' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: 검증**

지금까지의 작업으로 이미 만들어진 알림이 있는 계정(관리자 또는 일반 계정)의 브라우저 콘솔에서:

```js
const res = await fetch('/api/notifications');
const data = await res.json();
console.log(data.data.unreadCount, data.data.notifications.length);
```

기대 결과: `unreadCount > 0`.

```js
const first = data.data.notifications[0];
const readRes = await fetch(`/api/notifications/${first._id}/read`, { method: 'POST' });
console.log(readRes.status, await readRes.json());

const afterRes = await fetch('/api/notifications');
console.log((await afterRes.json()).data.unreadCount);
```

기대 결과: 두 번째 `unreadCount`가 첫 번째보다 1 작음.

```js
const readAllRes = await fetch('/api/notifications/read-all', { method: 'POST' });
console.log(readAllRes.status, await readAllRes.json());
const finalRes = await fetch('/api/notifications');
console.log((await finalRes.json()).data.unreadCount);
```

기대 결과: 마지막 `unreadCount === 0`.

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/notifications
git commit -m "$(cat <<'EOF'
Add notifications list and read APIs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: 죽은 admin 라우트 제거 + `/admin` 대시보드를 요청 목록으로 교체

**Files:**
- Delete: `src/app/api/admin/approve/route.ts`
- Delete: `src/app/api/admin/reject/route.ts`
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: 죽은 라우트 삭제**

```bash
git rm src/app/api/admin/approve/route.ts src/app/api/admin/reject/route.ts
```

(`src/app/api/admin/seed-categories`, `src/app/api/admin/sync-children`는 이 기능과 무관하므로 그대로 둔다.)

- [ ] **Step 2: `/admin/page.tsx` 전체 교체**

```tsx
'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface TechniqueRequestListItem {
  _id: string;
  type: 'create' | 'edit';
  status: 'pending' | 'approved' | 'rejected';
  payload: { name?: { ko?: string; en?: string } };
  targetTechniqueId?: { _id: string; name: { ko: string }; slug: string } | null;
  submittedBy: { nickname: string; email: string };
  createdAt: string;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState<TechniqueRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated' && session?.user?.role !== 'admin') {
      router.push('/');
    }
  }, [status, session, router]);

  useEffect(() => {
    async function fetchPending() {
      if (status === 'authenticated' && session?.user?.role === 'admin') {
        try {
          const res = await fetch('/api/technique-requests?status=pending');
          const data = await res.json();
          if (data.success) {
            setRequests(data.data);
          }
        } catch (error) {
          console.error('Failed to fetch pending requests', error);
        } finally {
          setLoading(false);
        }
      }
    }
    fetchPending();
  }, [status, session]);

  if (status === 'loading' || loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (status !== 'authenticated' || session?.user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="container py-6 lg:py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <div className="text-sm text-muted-foreground">
            Logged in as {session?.user?.email}
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
        >
          Logout
        </button>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-semibold">대기 중인 요청</h2>

        {requests.length === 0 ? (
          <p className="text-muted-foreground">검토할 요청이 없습니다.</p>
        ) : (
          <div className="rounded-md border">
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b">
                  <tr className="border-b transition-colors hover:bg-muted/50">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">유형</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">기술명</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">제출자</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">제출일</th>
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">액션</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {requests.map((req) => (
                    <tr key={req._id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 align-middle">
                        {req.type === 'create' ? '신규 등록' : '수정'}
                      </td>
                      <td className="p-4 align-middle font-medium">
                        {req.targetTechniqueId?.name.ko || req.payload.name?.ko || '(제목 없음)'}
                      </td>
                      <td className="p-4 align-middle">{req.submittedBy.nickname}</td>
                      <td className="p-4 align-middle">{new Date(req.createdAt).toLocaleDateString()}</td>
                      <td className="p-4 align-middle text-right">
                        <Link
                          href={`/admin/requests/${req._id}`}
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3"
                        >
                          검토하기
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 검증**

**관리자 계정**으로 `http://localhost:3001/admin`에 접속. 지금까지 테스트 중 만들어둔 `pending` 상태 요청들이 표에 보여야 한다(이미 승인/반려한 것들은 안 보여야 함 — `status=pending` 필터). 각 행의 "검토하기" 링크는 아직 `/admin/requests/[id]` 페이지가 없으므로 404가 나는 것이 정상이다(Task 11에서 만든다).

**일반 계정**으로 `http://localhost:3001/admin` 접속 시 `/`로 리다이렉트되는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/app/admin/page.tsx
git commit -m "$(cat <<'EOF'
Replace dead admin approval page with technique-requests list

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: 관리자 요청 검토 페이지 (`/admin/requests/[id]`)

**Files:**
- Create: `src/app/admin/requests/[id]/page.tsx`

- [ ] **Step 1: 페이지 작성**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface TechniqueRequestDetail {
  _id: string;
  type: 'create' | 'edit';
  status: 'pending' | 'approved' | 'rejected';
  payload: Record<string, unknown>;
  targetTechniqueId?: (Record<string, unknown> & { _id: string; updatedAt: string }) | null;
  submittedBy: { nickname: string; email: string };
  createdAt: string;
}

const FIELD_LABELS: Record<string, string> = {
  name: '기술명',
  aka: '별칭',
  description: '설명',
  type: '유형',
  primaryRole: '주 역할',
  roleTags: 'Role Tags',
  difficulty: '난이도',
  isCorePosition: '핵심 포지션 여부',
  positionType: '포지션 타입',
  parentId: '상위 기술',
  videos: '영상',
  images: '이미지',
  thumbnailUrl: '썸네일',
};

function stringifyValue(value: unknown): string {
  if (value === undefined || value === null) return '(없음)';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

export default function AdminRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [request, setRequest] = useState<TechniqueRequestDetail | null>(null);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [reviewNote, setReviewNote] = useState('');

  const id = params.id as string;

  useEffect(() => {
    if (status !== 'loading' && session?.user?.role !== 'admin') {
      router.push('/');
    }
  }, [status, session, router]);

  useEffect(() => {
    async function fetchRequest() {
      try {
        const res = await fetch(`/api/technique-requests/${id}`);
        const data = await res.json();
        if (data.success) {
          setRequest(data.data);
        } else {
          setError(data.error || '요청을 불러오지 못했습니다.');
        }
      } catch {
        setError('오류가 발생했습니다.');
      }
    }
    if (id && session?.user?.role === 'admin') fetchRequest();
  }, [id, session]);

  const handleApprove = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/technique-requests/${id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        router.push('/admin');
      } else {
        alert('승인 실패: ' + data.error);
      }
    } catch {
      alert('오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!reviewNote.trim()) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/technique-requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewNote }),
      });
      const data = await res.json();
      if (data.success) {
        router.push('/admin');
      } else {
        alert('반려 실패: ' + data.error);
      }
    } catch {
      alert('오류가 발생했습니다.');
    } finally {
      setProcessing(false);
      setShowRejectModal(false);
    }
  };

  if (status === 'loading' || (!request && !error)) {
    return <div className="p-8">Loading...</div>;
  }

  if (error || !request) {
    return <div className="p-8 text-destructive">{error}</div>;
  }

  const target = request.targetTechniqueId;
  const isStale = !!target && new Date(target.updatedAt as string) > new Date(request.createdAt);

  return (
    <div className="container max-w-2xl py-6 lg:py-10 space-y-6">
      <Link href="/admin" className="flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="mr-1 h-4 w-4" />
        요청 목록으로
      </Link>

      <div>
        <h1 className="text-2xl font-bold">
          {request.type === 'create' ? '신규 기술 등록 요청' : '기술 수정 요청'}
        </h1>
        <p className="text-sm text-muted-foreground">
          제출자: {request.submittedBy.nickname} ({request.submittedBy.email}) ·{' '}
          {new Date(request.createdAt).toLocaleString()}
        </p>
      </div>

      {isStale && (
        <div className="p-4 bg-amber-100 text-amber-900 rounded-md text-sm">
          관리자가 이 요청 제출 이후 이 기술을 직접 수정했습니다. 아래 &quot;변경 전&quot; 값은
          최신 상태를 기준으로 합니다.
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(request.payload).map(([key, value]) => (
          <div key={key} className="border rounded-md p-4 space-y-2">
            <div className="font-semibold text-sm">{FIELD_LABELS[key] || key}</div>
            {request.type === 'edit' && (
              <div className="text-sm">
                <div className="text-muted-foreground">변경 전</div>
                <pre className="whitespace-pre-wrap bg-muted/30 rounded p-2">
                  {stringifyValue(target ? target[key] : undefined)}
                </pre>
              </div>
            )}
            <div className="text-sm">
              <div className="text-muted-foreground">{request.type === 'edit' ? '변경 후' : '내용'}</div>
              <pre className="whitespace-pre-wrap bg-muted/30 rounded p-2">
                {stringifyValue(value)}
              </pre>
            </div>
          </div>
        ))}
      </div>

      {request.status === 'pending' ? (
        <div className="flex gap-2">
          <button
            onClick={handleApprove}
            disabled={processing}
            className="rounded-md bg-green-600 text-white hover:bg-green-700 h-10 px-4 disabled:opacity-50"
          >
            승인
          </button>
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={processing}
            className="rounded-md bg-red-600 text-white hover:bg-red-700 h-10 px-4 disabled:opacity-50"
          >
            반려
          </button>
        </div>
      ) : (
        <p className="text-muted-foreground">이미 처리된 요청입니다 ({request.status}).</p>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md space-y-4">
            <h3 className="font-semibold">반려 사유</h3>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              className="w-full h-24 rounded-md border border-input p-2 text-sm"
              placeholder="반려 사유를 입력하세요"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="rounded-md bg-muted px-4 py-2 text-sm"
              >
                취소
              </button>
              <button
                onClick={handleReject}
                disabled={!reviewNote.trim() || processing}
                className="rounded-md bg-red-600 text-white px-4 py-2 text-sm disabled:opacity-50"
              >
                반려 확정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 검증 — 수정 요청 diff 표시**

먼저 일반 계정으로 기존 published 기술 하나에 대해 이름과 설명을 바꾸는 수정 요청을 제출한다(Task 7 Step 3의 스니펫과 동일한 방식, 이번엔 `payload: { name: {ko: '새이름'}, description: {ko: '새설명'} }`). 관리자 계정으로 `http://localhost:3001/admin`에서 그 요청의 "검토하기"를 클릭.

기대 결과: 페이지가 "기술 수정 요청"으로 표시되고, `name`, `description` 두 필드 각각에 "변경 전"(현재 라이브 값)과 "변경 후"(제출된 값)이 나란히 보인다.

- [ ] **Step 3: 검증 — 신선도 경고**

같은 요청이 대기 중인 상태에서, 관리자 계정으로 `/technique/[slug]` 상세 페이지에 가서 그 기술을 직접 수정해 저장한다(예: 설명을 다르게 바꿈). 다시 `/admin/requests/[id]`로 돌아가면 "관리자가 이 요청 제출 이후 이 기술을 직접 수정했습니다" 경고 배너가 보여야 한다.

- [ ] **Step 4: 검증 — 승인/반려 동작**

"승인" 버튼을 눌러 `/admin`으로 리다이렉트되는지, DB에 반영되는지 확인(Task 7의 검증과 동일한 방식). 다른 pending 요청에 대해 "반려" 버튼 → 사유 입력 모달 → "반려 확정"까지 눌러 정상 동작하는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add "src/app/admin/requests/[id]/page.tsx"
git commit -m "$(cat <<'EOF'
Add admin technique-request review page with diff view

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: `/technique/new`를 로그인 사용자에게 개방 + 역할 분기 제출

**Files:**
- Modify: `src/app/technique/new/page.tsx`

- [ ] **Step 1: 접근 가드 완화**

`src/app/technique/new/page.tsx`에서 (약 56-68번째 줄) 다음을 교체:

```diff
-  useEffect(() => {
-    if (status !== 'loading' && session?.user?.role !== 'admin') {
-      router.push('/');
-    }
-  }, [status, session, router]);
-
-  if (status === 'loading') {
-    return <div className="p-8">Loading...</div>;
-  }
-
-  if (session?.user?.role !== 'admin') {
-    return null;
-  }
+  useEffect(() => {
+    if (status === 'unauthenticated') {
+      router.push('/auth/signin');
+    }
+  }, [status, router]);
+
+  if (status === 'loading') {
+    return <div className="p-8">Loading...</div>;
+  }
+
+  if (status === 'unauthenticated') {
+    return null;
+  }
```

- [ ] **Step 2: 안내 문구를 역할에 따라 다르게 표시**

```diff
         <div>
           <h1 className="text-3xl font-bold">새 기술 등록</h1>
-          <p className="text-muted-foreground">데이터베이스에 새로운 기술을 추가합니다.</p>
+          <p className="text-muted-foreground">
+            {session?.user?.role === 'admin'
+              ? '데이터베이스에 새로운 기술을 추가합니다.'
+              : '등록 요청을 제출합니다. 관리자 확인 후 게시됩니다.'}
+          </p>
         </div>
```

- [ ] **Step 3: `handleSubmit`을 역할 분기로 교체**

`handleSubmit` 함수 전체를 다음으로 교체:

```tsx
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Process data
      let finalImageUrl = formData.imageUrl;

      // Upload image if exists
      if (thumbnailFile) {
        const imageFormData = new FormData();
        imageFormData.append('file', thumbnailFile);
        imageFormData.append('usage', 'technique_thumbnail');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: imageFormData,
        });
        const uploadData = await uploadRes.json();

        if (uploadData.success) {
          finalImageUrl = uploadData.data.url;
        } else {
          throw new Error('Image upload failed');
        }
      }

      const payload = {
        name: formData.name,
        aka: {
          ko: formData.aka.ko,
          en: formData.aka.en,
        },
        description: formData.description,
        type: formData.type,
        primaryRole: formData.primaryRole,
        roleTags: formData.roleTags.split(',').map(s => s.trim()).filter(Boolean),
        difficulty: Number(formData.difficulty),
        isCorePosition: formData.isCorePosition,
        positionType: formData.positionType,
        parentId: formData.parentId || null,
        videos: formData.videoUrls.filter(url => url.trim()).map(url => ({ url })),
        images: finalImageUrl ? [{ url: finalImageUrl, isPrimary: true }] : [],
        thumbnailUrl: finalImageUrl,
      };

      const isAdmin = session?.user?.role === 'admin';

      if (isAdmin) {
        const res = await fetch('/api/techniques', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, status: 'published' }),
        });

        const data = await res.json();
        if (data.success) {
          const slug = data.data.slug;
          const path = [...(data.data.pathSlugs || []), slug].join('/');
          router.push(`/technique/${path}`);
        } else {
          setError(data.error || '기술 생성에 실패했습니다.');
        }
      } else {
        const res = await fetch('/api/technique-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'create', payload }),
        });

        const data = await res.json();
        if (data.success) {
          alert('등록 요청이 접수되었습니다. 관리자 확인 후 게시됩니다.');
          router.push('/profile');
        } else {
          setError(data.error || '등록 요청에 실패했습니다.');
        }
      }
    } catch {
      setError('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 4: 검증**

**일반 계정**으로 `http://localhost:3001/technique/new` 접속(더 이상 `/`로 리다이렉트되지 않아야 함). 안내 문구가 "등록 요청을 제출합니다..."로 보이는지 확인. 폼을 채워 제출 → alert 후 `/profile`로 이동하는지 확인.

```bash
mongosh "$MONGODB_URI" --quiet --eval "db.techniquerequests.find({type:'create'}).sort({createdAt:-1}).limit(1).pretty()"
```

기대 결과: 방금 제출한 내용이 `status: 'pending'`으로 저장됨. 동시에:

```bash
mongosh "$MONGODB_URI" --quiet --eval "db.techniques.find({'name.ko': '<방금 입력한 이름>'}).count()"
```

기대 결과: `0` (아직 라이브에는 반영되지 않았어야 함).

**관리자 계정**으로 같은 페이지에서 등록하면 여전히 즉시 게시되고 기술 상세 페이지로 이동하는지 확인(회귀 없음).

- [ ] **Step 5: 커밋**

```bash
git add src/app/technique/new/page.tsx
git commit -m "$(cat <<'EOF'
Open technique registration to all logged-in users via requests

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: 기술 상세 페이지 — 역할 분기 편집/저장

**Files:**
- Modify: `src/app/technique/[...slug]/page.tsx`

- [ ] **Step 1: `useSession` 도입, `canEditTechnique` 제거**

최상단 import에 추가:

```diff
 import { useEffect, useState } from 'react';
 import { useParams, useRouter } from 'next/navigation';
+import { useSession } from 'next-auth/react';
 import ReactMarkdown from 'react-markdown';
```

`canEditTechnique` 함수 선언(약 37-42번째 줄)을 삭제:

```diff
-// Permission check - currently allows everyone, but can be extended
-function canEditTechnique(/* user?: User */): boolean {
-  // TODO: Add authentication check when auth is implemented
-  // For now, allow everyone to edit
-  return true;
-}
-
```

컴포넌트 함수 맨 위(`const params = useParams();` 근처)에 세션 훅과 파생 값 추가:

```diff
 export default function TechniquePage() {
   const params = useParams();
   const router = useRouter();
+  const { data: session } = useSession();
   const [technique, setTechnique] = useState<Technique | null>(null);
```

그리고 렌더링 직전 어딘가(예: `translateType` 함수 다음)에 추가:

```tsx
  const canEdit = !!session;
  const isAdmin = session?.user?.role === 'admin';
```

- [ ] **Step 2: 액션 버튼 JSX 수정 — 수정은 로그인 사용자, 삭제는 admin만**

기존 (약 411-430번째 줄):

```tsx
            {canEditTechnique() && !isEditing && (
              <div className="flex items-center rounded-md border border-input bg-background shadow-sm">
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors border-r border-input last:border-0 rounded-l-md"
                >
                  <Edit className="h-3.5 w-3.5" />
                  수정
                </button>
                <button
                  onClick={handleDeleteClick}
                  disabled={deleting}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 rounded-r-md"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  삭제
                </button>
              </div>
            )}
```

교체 후:

```tsx
            {canEdit && !isEditing && (
              <div className="flex items-center rounded-md border border-input bg-background shadow-sm">
                <button
                  onClick={handleEdit}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors rounded-l-md ${
                    isAdmin ? 'border-r border-input' : 'rounded-r-md'
                  }`}
                >
                  <Edit className="h-3.5 w-3.5" />
                  수정
                </button>
                {isAdmin && (
                  <button
                    onClick={handleDeleteClick}
                    disabled={deleting}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 rounded-r-md"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    삭제
                  </button>
                )}
              </div>
            )}
```

- [ ] **Step 3: `handleSave`를 역할 분기로 교체**

`handleSave` 함수 전체(약 252-345번째 줄)를 다음으로 교체:

```tsx
  const handleSave = async () => {
    if (!technique) return;

    setSaving(true);
    try {
      let finalImageUrl = editForm.thumbnailUrl;

      // Upload image if exists
      if (thumbnailFile) {
        const imageFormData = new FormData();
        imageFormData.append('file', thumbnailFile);
        imageFormData.append('usage', 'technique_thumbnail');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: imageFormData,
        });
        const uploadData = await uploadRes.json();

        if (uploadData.success) {
          finalImageUrl = uploadData.data.url;
        } else {
          throw new Error('Image upload failed');
        }
      }

      const payload = {
        name: {
          ko: editForm.name.ko,
          en: editForm.name.en || undefined,
        },
        description: {
          ko: editForm.description.ko,
          en: editForm.description.en || undefined,
        },
        aka: {
          ko: editForm.aka.ko,
          en: editForm.aka.en.length > 0 ? editForm.aka.en : undefined,
        },
        type: editForm.type,
        primaryRole: editForm.primaryRole,
        roleTags: editForm.roleTags.split(',').map(s => s.trim()).filter(Boolean),
        parentId: editForm.parentId || null,
        videos: editForm.videoUrls.filter(url => url.trim()).map(url => ({ url })),
        thumbnailUrl: finalImageUrl,
      };

      if (isAdmin) {
        const res = await fetch(`/api/techniques/${technique._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (data.success) {
          // Refresh the technique data
          const detailRes = await fetch(`/api/techniques/${technique._id}`);
          const detailData = await detailRes.json();
          if (detailData.success) {
            setTechnique(detailData.data);
            setEditForm({
              name: {
                ko: detailData.data.name.ko,
                en: detailData.data.name.en || ''
              },
              description: {
                ko: detailData.data.description.ko,
                en: detailData.data.description.en || ''
              },
              aka: {
                ko: detailData.data.aka.ko || [],
                en: detailData.data.aka.en || [],
              },
              type: detailData.data.type || 'both',
              primaryRole: detailData.data.primaryRole || 'position',
              roleTags: detailData.data.roleTags?.join(', ') || '',
              parentId: detailData.data.parentId?._id || null,
              videoUrls: detailData.data.videos?.map((v: any) => v.url) || [],
              thumbnailUrl: detailData.data.thumbnailUrl || '',
            });
            setPreviewUrl(detailData.data.thumbnailUrl || '');
          }
          setIsEditing(false);
        } else {
          alert('저장 실패: ' + data.error);
        }
      } else {
        const res = await fetch('/api/technique-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'edit',
            targetTechniqueId: technique._id,
            payload,
          }),
        });

        const data = await res.json();
        if (data.success) {
          alert('수정 요청이 접수되었습니다. 관리자 확인 후 반영됩니다.');
          setIsEditing(false);
        } else {
          alert('요청 실패: ' + data.error);
        }
      }
    } catch (err) {
      alert('저장 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };
```

- [ ] **Step 4: 검증 — 일반 계정 수정 요청**

**일반 계정**으로 아무 기술 상세 페이지에 가서 "수정" 버튼(삭제 버튼은 보이지 않아야 함)을 눌러 설명을 바꾸고 "저장". alert("수정 요청이 접수되었습니다...")가 뜨고 편집 모드가 닫히되, 화면에 표시된 설명은 **바뀌지 않은 원본 그대로**여야 한다.

```bash
mongosh "$MONGODB_URI" --quiet --eval "db.techniquerequests.find({type:'edit'}).sort({createdAt:-1}).limit(1).pretty()"
```

기대 결과: 방금 제출한 내용이 `pending`으로 저장.

```bash
mongosh "$MONGODB_URI" --quiet --eval "db.techniques.findOne({_id: ObjectId('<technique _id>')}, {description:1})"
```

기대 결과: `description`이 원본 그대로.

- [ ] **Step 5: 검증 — 관리자 계정 회귀 없음 + 삭제 버튼 노출**

**관리자 계정**으로 같은 페이지에서 "수정" + "삭제" 버튼이 모두 보이는지, 수정 저장 시 이전처럼 즉시 반영되는지 확인(Task 2 Step 5와 동일한 방식).

- [ ] **Step 6: 커밋**

```bash
git add "src/app/technique/[...slug]/page.tsx"
git commit -m "$(cat <<'EOF'
Route non-admin technique edits through the request queue

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: 프로필 페이지에 "내 요청" 섹션 추가

**Files:**
- Create: `src/components/profile/MyRequestsSection.tsx`
- Modify: `src/app/profile/page.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface MyRequestItem {
  _id: string;
  type: 'create' | 'edit';
  status: 'pending' | 'approved' | 'rejected';
  payload: { name?: { ko?: string; en?: string } };
  targetTechniqueId?: { _id: string; name: { ko: string }; slug: string; pathSlugs?: string[] } | null;
  reviewNote?: string;
  createdAt: string;
}

const STATUS_LABELS: Record<MyRequestItem['status'], string> = {
  pending: '대기중',
  approved: '승인됨',
  rejected: '반려됨',
};

const STATUS_STYLES: Record<MyRequestItem['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export function MyRequestsSection() {
  const [requests, setRequests] = useState<MyRequestItem[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchRequests() {
      try {
        const res = await fetch('/api/technique-requests?mine=1');
        const data = await res.json();
        if (data.success) {
          setRequests(data.data);
        } else {
          setError(data.error || '요청 내역을 불러오지 못했습니다.');
        }
      } catch {
        setError('오류가 발생했습니다.');
      }
    }
    fetchRequests();
  }, []);

  if (error && !requests) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-md mt-6">
        {error}
      </div>
    );
  }

  if (!requests) {
    return <div className="mt-6 text-muted-foreground">불러오는 중...</div>;
  }

  return (
    <div className="mt-10 space-y-4">
      <h2 className="text-2xl font-bold">내 요청</h2>

      {requests.length === 0 && (
        <p className="text-muted-foreground">제출한 등록/수정 요청이 없습니다.</p>
      )}

      <ul className="space-y-2">
        {requests.map((req) => {
          const name = req.targetTechniqueId?.name.ko || req.payload.name?.ko || '(제목 없음)';
          return (
            <li key={req._id} className="rounded-md border p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {req.type === 'create' ? '신규 등록' : '수정'} · {name}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[req.status]}`}>
                  {STATUS_LABELS[req.status]}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(req.createdAt).toLocaleString()}
              </div>
              {req.status === 'rejected' && req.reviewNote && (
                <div className="text-sm text-destructive">사유: {req.reviewNote}</div>
              )}
              {req.status === 'approved' && req.targetTechniqueId && (
                <Link
                  href={`/technique/${[...(req.targetTechniqueId.pathSlugs || []), req.targetTechniqueId.slug].join('/')}`}
                  className="text-sm text-primary hover:underline"
                >
                  기술 보러가기
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: 프로필 페이지에 연결**

`src/app/profile/page.tsx`:

```diff
 import { MySkillsSection } from '@/components/profile/MySkillsSection';
+import { MyRequestsSection } from '@/components/profile/MyRequestsSection';
```

```diff
       {profile && <MySkillsSection />}
+      {profile && <MyRequestsSection />}
```

- [ ] **Step 3: 검증**

Task 12, 13에서 만들어둔 요청들이 있는 계정으로 `http://localhost:3001/profile`에 접속. "내 요청" 섹션에 각 요청의 유형/이름/상태 뱃지가 보이고, 반려된 것은 사유가, 승인된 것은 "기술 보러가기" 링크가 보이는지 확인. 링크를 클릭해 실제 기술 페이지로 이동하는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/components/profile/MyRequestsSection.tsx src/app/profile/page.tsx
git commit -m "$(cat <<'EOF'
Add My Requests section to the profile page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: 알림 벨 (`NotificationBell`) + Navbar 연결

**Files:**
- Create: `src/components/layout/NotificationBell.tsx`
- Modify: `src/components/layout/NavbarClient.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';

interface NotificationItem {
  _id: string;
  type: 'request_approved' | 'request_rejected' | 'new_request';
  message: string;
  relatedRequestId: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data.notifications);
        setUnreadCount(data.data.unreadCount);
      }
    } catch {
      // Silently ignore; the bell just won't update this cycle.
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleNotificationClick = async (notification: NotificationItem) => {
    if (!notification.isRead) {
      await fetch(`/api/notifications/${notification._id}/read`, { method: 'POST' });
      fetchNotifications();
    }
    setIsOpen(false);
    if (notification.type === 'new_request') {
      router.push(`/admin/requests/${notification.relatedRequestId}`);
    } else {
      router.push('/profile');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 w-9"
        aria-label="알림"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto rounded-md border bg-background shadow-lg z-50">
          {notifications.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">알림이 없습니다.</div>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li key={n._id}>
                  <button
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left px-4 py-3 text-sm border-b last:border-0 hover:bg-accent ${
                      n.isRead ? 'text-muted-foreground' : 'font-medium'
                    }`}
                  >
                    {n.message}
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Navbar에 연결 + "기술 등록" 버튼 노출 조건 확장**

`src/components/layout/NavbarClient.tsx`:

```diff
 import { SearchModal } from '@/components/ui/SearchModal';
 import { Sidebar } from '@/components/layout/Sidebar';
+import { NotificationBell } from '@/components/layout/NotificationBell';
```

```diff
-            {(status === 'unauthenticated' ||
-              (status === 'authenticated' && session?.user?.role === 'admin')) && (
+            {status !== 'loading' && (
               <Link
                 href={status === 'unauthenticated' ? '/auth/signup' : '/technique/new'}
                 className="inline-flex text-primary items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-accent text-accent-foreground hover:bg-accent/90 h-9 px-4 py-2"
               >
                 <Plus className="mr-2 h-4 w-4" />
                 <span className="hidden sm:inline">기술 등록</span>
                 <span className="sm:hidden">등록</span>
               </Link>
             )}
+            {status === 'authenticated' && <NotificationBell />}
             {status === 'authenticated' && (
```

- [ ] **Step 3: 검증**

**일반 계정**으로 로그인 후 헤더에 "기술 등록" 버튼과 알림 벨이 모두 보이는지 확인. 관리자 계정에서 그 계정의 수정 요청을 승인하거나 반려한 뒤(Task 7/8/11 검증에서 만든 것들 재사용 가능), 60초 이내(또는 페이지 새로고침 직후) 벨에 빨간 점이 뜨는지 확인. 벨을 클릭해 드롭다운에서 메시지를 확인하고 클릭 시 `/profile`로 이동하며 빨간 점이 사라지는지 확인.

**관리자 계정**으로는, 다른 계정이 새 요청을 제출한 직후 벨에 빨간 점이 뜨고, 클릭 시 해당 `/admin/requests/[id]`로 이동하는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/components/layout/NotificationBell.tsx src/components/layout/NavbarClient.tsx
git commit -m "$(cat <<'EOF'
Add notification bell to navbar and open technique registration link to all users

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## 최종 확인

모든 작업 완료 후:

```bash
npx tsc --noEmit
npm run lint
```

기대 결과: 둘 다 에러 없음.

전체 시나리오를 처음부터 한 번 더 손으로 훑는다: 일반 계정으로 신규 기술 등록 요청 제출 → 관리자 알림 도착 확인 → 관리자가 `/admin`에서 검토 → 승인 → 일반 계정 알림 도착 확인 + `/profile`의 "내 요청"에서 승인됨 확인 + 실제 기술 페이지 게시 확인. 이어서 기존 기술에 대한 수정 요청도 동일하게 한 번, 이번엔 반려 경로로 끝까지 확인한다.
