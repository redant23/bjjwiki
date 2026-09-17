# 최근 업데이트 노출 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메인 페이지 공지 스크롤, 사이드바 최근수정 배지/정렬, 기술 상세 페이지의
게시자·수정자 닉네임 노출을 구현한다.

**Architecture:** `Technique` 스키마에 콘텐츠 편집 시각만 기록하는 `contentUpdatedAt`
필드를 추가하고, 생성/수정 서비스 함수(`createTechniqueFromPayload`,
`applyTechniqueEdit`)가 이 필드와 `createdBy`/`lastEditedBy`를 채우도록 배선한다.
사이드바와 메인 페이지는 이 필드를 기준으로 "최근 3일" 여부를 판정하고, 상세
페이지는 populate된 `createdBy`/`lastEditedBy`를 그대로 렌더링한다.

**Tech Stack:** Next.js App Router (server/client component 혼합), Mongoose,
Tailwind CSS v4. 이 프로젝트에는 테스트 러너가 없다(`package.json` 스크립트는
`dev`/`build`/`start`/`lint`뿐). 새 테스트 프레임워크는 도입하지 않고, 각 작업의
검증은 `npm run lint` + `npm run build`(타입체크 포함) + 필요 시 `node -e`를
이용한 순수 함수 수동 확인 + 마지막 브라우저 검증으로 대체한다.

**참고 스펙:** `docs/superpowers/specs/2026-09-17-recent-update-visibility-design.md`

---

### Task 1: `Technique` 모델에 `contentUpdatedAt` 필드 추가

**Files:**
- Modify: `src/models/Technique.ts:70-79` (interface), `:164-177` (schema), `:189-192` (인덱스)

- [ ] **Step 1: interface에 필드 추가**

`src/models/Technique.ts`의 `ITechnique` interface, `lastEditedBy?` 바로 아래에 추가:

```ts
  // 8. Metadata
  status: 'draft' | 'published' | 'archived';
  createdBy?: mongoose.Types.ObjectId;
  lastEditedBy?: mongoose.Types.ObjectId;
  contentUpdatedAt?: Date; // 콘텐츠가 실제로 편집된 시각. reorder/부모-자식 정리는 이 필드를 건드리지 않는다.
  viewCount: number;
  likeCount: number;
```

- [ ] **Step 2: schema에 필드 추가**

같은 파일의 schema 정의에서 `lastEditedBy: { type: Schema.Types.ObjectId, ref: 'User' },`
바로 아래에 추가:

```ts
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }, // Assuming User model exists or will exist
    lastEditedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    contentUpdatedAt: { type: Date, index: true },
    viewCount: { type: Number, default: 0, index: true },
```

- [ ] **Step 3: 공지 섹션 쿼리용 복합 인덱스 추가**

`TechniqueSchema.index({ positionType: 1, isCorePosition: 1 });` 바로 아래에 추가:

```ts
TechniqueSchema.index({ status: 1, contentUpdatedAt: -1 });
```

- [ ] **Step 4: 타입체크로 확인**

Run: `npm run build`
Expected: 기존과 동일하게 컴파일 성공 (새 optional 필드라 기존 코드를 깨지 않음).

- [ ] **Step 5: Commit**

```bash
git add src/models/Technique.ts
git commit -m "Add contentUpdatedAt field to Technique model

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: 공유 상수/헬퍼 `src/lib/recent-update.ts` 생성

**Files:**
- Create: `src/lib/recent-update.ts`

- [ ] **Step 1: 파일 생성**

`src/lib/technique-service.ts`는 `mongoose`/`dbConnect`를 import하는 서버 전용
모듈이라 `'use client'`인 `Sidebar.tsx`에서 가져올 수 없다. 서버/클라이언트
양쪽에서 안전하게 쓸 순수 함수 파일을 별도로 만든다.

```ts
export const RECENT_UPDATE_WINDOW_DAYS = 3;

export function isWithinRecentWindow(
  contentUpdatedAt: string | Date | undefined | null
): boolean {
  if (!contentUpdatedAt) return false; // 레거시 기술: 편집 이력 없음 -> 최근 아님
  const ms = RECENT_UPDATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(contentUpdatedAt).getTime() < ms;
}
```

- [ ] **Step 2: 수동으로 경계값 확인**

Run:
```bash
node -e "
const RECENT_UPDATE_WINDOW_DAYS = 3;
function isWithinRecentWindow(d) {
  if (!d) return false;
  const ms = RECENT_UPDATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(d).getTime() < ms;
}
console.log('null ->', isWithinRecentWindow(null));
console.log('now ->', isWithinRecentWindow(new Date()));
console.log('2 days ago ->', isWithinRecentWindow(new Date(Date.now() - 2*24*60*60*1000)));
console.log('4 days ago ->', isWithinRecentWindow(new Date(Date.now() - 4*24*60*60*1000)));
"
```

Expected:
```
null -> false
now -> true
2 days ago -> true
4 days ago -> false
```

(이 스니펫은 `src/lib/recent-update.ts`와 동일한 로직을 순수 JS로 재현해 경계값만
확인하는 용도이며, 실제 파일을 실행하는 것은 아니다 — 프로젝트에 테스트 러너가
없어 `.ts` 모듈을 직접 실행할 수 없기 때문.)

- [ ] **Step 3: 타입체크**

Run: `npm run build`
Expected: 컴파일 성공 (아직 아무 곳에서도 import하지 않으므로 unused-export
경고만 있을 수 있음 — 에러 아님).

- [ ] **Step 4: Commit**

```bash
git add src/lib/recent-update.ts
git commit -m "Add shared recent-update-window helper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `createTechniqueFromPayload` / `applyTechniqueEdit`에 actor·시각 배선

**Files:**
- Modify: `src/lib/technique-service.ts:88-136` (`createTechniqueFromPayload`), `:163-212` (`applyTechniqueEdit`)

- [ ] **Step 1: `createTechniqueFromPayload` 시그니처와 생성 호출 수정**

`src/lib/technique-service.ts`에서:

```ts
export async function createTechniqueFromPayload(payload: Record<string, unknown>): Promise<ITechnique> {
```

를 다음으로 교체:

```ts
export async function createTechniqueFromPayload(
  payload: Record<string, unknown>,
  actorId?: string
): Promise<ITechnique> {
```

그리고 같은 함수 안의 생성 호출:

```ts
  // 3. Create Technique
  const technique = (await Technique.create({
    ...body,
    status: body.status || 'draft',
  })) as unknown as ITechnique;
```

를 다음으로 교체:

```ts
  // 3. Create Technique
  const technique = (await Technique.create({
    ...body,
    status: body.status || 'draft',
    contentUpdatedAt: new Date(),
    ...(actorId && { createdBy: actorId }),
  })) as unknown as ITechnique;
```

- [ ] **Step 2: `applyTechniqueEdit` 시그니처와 update 조립부 수정**

```ts
export async function applyTechniqueEdit(
  id: string,
  payload: Record<string, unknown>
): Promise<ITechnique | null> {
```

를 다음으로 교체:

```ts
export async function applyTechniqueEdit(
  id: string,
  payload: Record<string, unknown>,
  actorId?: string
): Promise<ITechnique | null> {
```

그리고 함수 뒷부분의:

```ts
  const update = buildTechniqueUpdateSet(body);
  if (Object.keys(update).length === 0) {
    return currentTechnique;
  }

  const technique = await Technique.findByIdAndUpdate(
```

를 다음으로 교체 (early-return **다음에** 주입해야, 실질 변경이 없는 저장
요청이 "방금 수정됨"으로 오인되지 않는다):

```ts
  const update = buildTechniqueUpdateSet(body);
  if (Object.keys(update).length === 0) {
    return currentTechnique;
  }

  if (actorId) {
    update.lastEditedBy = actorId;
  }
  update.contentUpdatedAt = new Date();

  const technique = await Technique.findByIdAndUpdate(
```

- [ ] **Step 3: 타입체크**

Run: `npm run build`
Expected: 컴파일 성공. `actorId`는 optional이라 기존 호출부(`createTechniqueFromPayload(body)`,
`applyTechniqueEdit(id, body)`)는 그대로 동작.

- [ ] **Step 4: Commit**

```bash
git add src/lib/technique-service.ts
git commit -m "Wire createdBy/lastEditedBy/contentUpdatedAt into technique write paths

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: API 라우트에서 actorId 전달

**Files:**
- Modify: `src/app/api/techniques/route.ts:91-115` (POST)
- Modify: `src/app/api/techniques/[id]/route.ts:39-68` (PUT)
- Modify: `src/app/api/technique-requests/[id]/approve/route.ts:42-59`

- [ ] **Step 1: 직접 생성(POST) — 관리자 세션 id 전달**

`src/app/api/techniques/route.ts`의 `POST` 함수에서:

```ts
export async function POST(request: Request) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;
```

를 다음으로 교체:

```ts
export async function POST(request: Request) {
  try {
    const { session, error: authError } = await requireAdmin();
    if (authError) return authError;
```

그리고:

```ts
    const body = await request.json();
    const technique = await createTechniqueFromPayload({
      ...body,
      status: body.status || 'draft',
    });
```

를 다음으로 교체:

```ts
    const body = await request.json();
    const technique = await createTechniqueFromPayload({
      ...body,
      status: body.status || 'draft',
    }, session!.user.id);
```

- [ ] **Step 2: 직접 수정(PUT) — 관리자 세션 id 전달**

`src/app/api/techniques/[id]/route.ts`의 `PUT` 함수에서:

```ts
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const body = await request.json();
    const technique = await applyTechniqueEdit(params.id, body);
```

를 다음으로 교체:

```ts
    const { session, error: authError } = await requireAdmin();
    if (authError) return authError;

    const body = await request.json();
    const technique = await applyTechniqueEdit(params.id, body, session!.user.id);
```

- [ ] **Step 3: 요청 승인(approve) — 요청 작성자 id 전달**

`src/app/api/technique-requests/[id]/approve/route.ts`에서:

```ts
    if (techniqueRequest.type === 'create') {
      const created = await createTechniqueFromPayload({
        ...techniqueRequest.payload,
        status: 'published',
      });
```

를 다음으로 교체:

```ts
    if (techniqueRequest.type === 'create') {
      const created = await createTechniqueFromPayload({
        ...techniqueRequest.payload,
        status: 'published',
      }, techniqueRequest.submittedBy.toString());
```

그리고:

```ts
      const updated = await applyTechniqueEdit(targetId, techniqueRequest.payload);
```

를 다음으로 교체:

```ts
      const updated = await applyTechniqueEdit(
        targetId,
        techniqueRequest.payload,
        techniqueRequest.submittedBy.toString()
      );
```

- [ ] **Step 4: 타입체크**

Run: `npm run build`
Expected: 컴파일 성공.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/techniques/route.ts src/app/api/techniques/[id]/route.ts src/app/api/technique-requests/[id]/approve/route.ts
git commit -m "Pass actor id into technique create/edit calls from API routes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: 기술 상세 GET에서 게시자/수정자 populate

**Files:**
- Modify: `src/app/api/techniques/[id]/route.ts:9-37` (GET)

- [ ] **Step 1: populate 체인에 추가**

```ts
    const technique = await Technique.findById(params.id)
      .populate('parentId', 'name slug')
      .populate('childrenIds', 'name slug type primaryRole')
      .populate('sweepsFromHere', 'name slug')
      .populate('submissionsFromHere', 'name slug')
      .populate('escapesFromHere', 'name slug');
```

를 다음으로 교체:

```ts
    const technique = await Technique.findById(params.id)
      .populate('parentId', 'name slug')
      .populate('childrenIds', 'name slug type primaryRole')
      .populate('sweepsFromHere', 'name slug')
      .populate('submissionsFromHere', 'name slug')
      .populate('escapesFromHere', 'name slug')
      .populate('createdBy', 'nickname')
      .populate('lastEditedBy', 'nickname');
```

- [ ] **Step 2: 타입체크**

Run: `npm run build`
Expected: 컴파일 성공.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/techniques/[id]/route.ts
git commit -m "Populate createdBy/lastEditedBy nickname on technique detail GET

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: 상세 페이지 footer에 게시자/수정자 노출

**Files:**
- Modify: `src/app/technique/[...slug]/page.tsx:18-38` (interface), `:731-733` (footer)

- [ ] **Step 1: interface에 필드 추가**

`Technique` interface에서:

```ts
  roleTags?: string[];
  updatedAt: string;
}
```

를 다음으로 교체:

```ts
  roleTags?: string[];
  updatedAt: string;
  createdBy?: { nickname: string } | null;
  lastEditedBy?: { nickname: string } | null;
}
```

- [ ] **Step 2: footer 렌더링 수정**

```tsx
        <footer className="pt-6 text-sm text-muted-foreground border-t border-border">
          최종 수정: {new Date(technique.updatedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
        </footer>
```

를 다음으로 교체:

```tsx
        <footer className="pt-6 text-sm text-muted-foreground border-t border-border">
          최종 수정: {new Date(technique.updatedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
          {technique.createdBy && ` · 게시자: ${technique.createdBy.nickname}`}
          {technique.lastEditedBy && ` · 수정자: ${technique.lastEditedBy.nickname}`}
        </footer>
```

(`createdBy`/`lastEditedBy`가 없는 레거시 기술은 두 세그먼트 모두 `false`가 되어
아무것도 렌더링되지 않는다 — placeholder 텍스트 없음.)

- [ ] **Step 3: 타입체크**

Run: `npm run build`
Expected: 컴파일 성공.

- [ ] **Step 4: Commit**

```bash
git add "src/app/technique/[...slug]/page.tsx"
git commit -m "Show publisher/editor nickname on technique detail footer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: `technique-service.ts`에 최근 수정 목록 조회 + 트리 select 확장

**Files:**
- Modify: `src/lib/technique-service.ts:1-47` (`getTechniqueTree`), 파일 하단에 새 함수 추가

- [ ] **Step 1: import 추가**

파일 상단:

```ts
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Technique, { ITechnique } from '@/models/Technique';
import { unstable_cache } from 'next/cache';
```

를 다음으로 교체:

```ts
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Technique, { ITechnique } from '@/models/Technique';
import { unstable_cache } from 'next/cache';
import { RECENT_UPDATE_WINDOW_DAYS } from '@/lib/recent-update';
```

- [ ] **Step 2: `getTechniqueTree`의 select/매핑에 `contentUpdatedAt` 추가**

```ts
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
```

를 다음으로 교체:

```ts
    const techniques = await Technique.find({ status: 'published' })
      .select('_id name slug parentId pathSlugs order level contentUpdatedAt')
      .sort({ order: 1, 'name.ko': 1 })
      .lean();

    // Convert _id and parentId to string to avoid serialization issues
    const plainTechniques = techniques.map(tech => ({
      ...tech,
      _id: tech._id.toString(),
      parentId: tech.parentId ? tech.parentId.toString() : null,
      contentUpdatedAt: tech.contentUpdatedAt ? tech.contentUpdatedAt.toISOString() : null,
      children: [] as any[], // Initialize children array
    }));
```

- [ ] **Step 3: 최근 수정 목록 함수를 파일 맨 끝에 추가**

`src/lib/technique-service.ts` 맨 끝(`applyTechniqueEdit` 함수 뒤)에 추가:

```ts
export interface RecentlyUpdatedTechnique {
  _id: string;
  name: string;
  href: string;
}

export async function getRecentlyUpdatedTechniques(
  limit = 10
): Promise<RecentlyUpdatedTechnique[]> {
  await dbConnect();
  const since = new Date(Date.now() - RECENT_UPDATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const techniques = await Technique.find({
    status: 'published',
    contentUpdatedAt: { $gte: since },
  })
    .select('_id name slug pathSlugs contentUpdatedAt')
    .sort({ contentUpdatedAt: -1 })
    .limit(limit)
    .lean();

  return techniques.map((tech) => ({
    _id: tech._id.toString(),
    name: tech.name.ko,
    href: `/technique/${[...(tech.pathSlugs || []), tech.slug].join('/')}`,
  }));
}
```

- [ ] **Step 4: 타입체크**

Run: `npm run build`
Expected: 컴파일 성공.

- [ ] **Step 5: Commit**

```bash
git add src/lib/technique-service.ts
git commit -m "Add getRecentlyUpdatedTechniques and expose contentUpdatedAt on the tree

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: 마퀴(marquee) CSS 애니메이션 추가

**Files:**
- Modify: `src/app/globals.css:135-161` (`@layer utilities` 블록 뒤)

- [ ] **Step 1: keyframes + 유틸리티 클래스 추가**

`src/app/globals.css` 파일 끝(`@layer utilities { ... }` 블록의 닫는 `}` 바로 뒤,
161번째 줄 이후)에 추가:

```css

@layer utilities {
  .animate-marquee {
    animation: marquee linear infinite;
  }
}

@keyframes marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}
```

(기존 `@layer utilities` 블록과는 별도로 새 블록을 추가한다 — 기존 `.step` 관련
규칙을 건드리지 않기 위해서다. `translateX(-50%)`는 트랙 안에 항목을 정확히
2벌 복제해 이어붙였을 때 정확히 한 벌 분량만큼 이동해 끊김 없이 반복되게 한다.)

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 컴파일 성공 (CSS 문법 오류 없음).

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "Add marquee keyframe animation utility

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: `AnnouncementTicker` 컴포넌트 생성

**Files:**
- Create: `src/components/home/AnnouncementTicker.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
'use client';

import Link from 'next/link';

export interface AnnouncementItem {
  _id: string;
  name: string;
  href: string;
}

interface AnnouncementTickerProps {
  items: AnnouncementItem[];
}

export function AnnouncementTicker({ items }: AnnouncementTickerProps) {
  if (items.length === 0) {
    return null;
  }

  if (items.length === 1) {
    const item = items[0];
    return (
      <div className="w-full border-b border-border bg-accent/10 py-2">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 text-sm sm:px-6 lg:px-8">
          <span className="shrink-0 font-semibold text-accent">공지</span>
          <Link href={item.href} className="truncate hover:underline">
            {item.name} 기술이 새로 업데이트되었습니다.
          </Link>
        </div>
      </div>
    );
  }

  // 항목 수에 비례해 한 바퀴 도는 시간을 늘려, 항목이 많아도 읽을 시간을 확보한다.
  const durationSeconds = Math.max(items.length * 4, 15);

  return (
    <div className="w-full overflow-hidden border-b border-border bg-accent/10 py-2">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <span className="shrink-0 text-sm font-semibold text-accent">공지</span>
        <div className="relative flex-1 overflow-hidden">
          <div
            className="animate-marquee flex w-max whitespace-nowrap"
            style={{ animationDuration: `${durationSeconds}s` }}
          >
            {/* 두 벌을 감싸는 바깥 트랙에는 gap을 주지 않는다 — 두 벌의 폭이
                정확히 같아야 translateX(-50%)가 이음매 없이 딱 맞아떨어진다.
                항목 사이 간격(gap-8)과 이음매 간격(pr-8)은 각 벌 안에서
                동일하게 줘서 반복 지점에서 간격이 튀지 않게 한다. */}
            <div className="flex items-center gap-8 pr-8">
              {items.map((item) => (
                <Link key={item._id} href={item.href} className="text-sm hover:underline">
                  {item.name} 기술이 새로 업데이트되었습니다.
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-8 pr-8" aria-hidden="true">
              {items.map((item) => (
                <Link
                  key={`clone-${item._id}`}
                  href={item.href}
                  className="text-sm hover:underline"
                  tabIndex={-1}
                >
                  {item.name} 기술이 새로 업데이트되었습니다.
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**중요 (marquee 리뷰에서 발견된 함정):** 바깥 트랙(`animate-marquee`가 붙는 div)과 두 벌
사이에는 절대 `gap`을 주면 안 된다. 두 벌을 감싸는 각각의 `<div>`가 정확히 같은 폭이어야만
`translateX(-50%)`가 정확히 한 벌 분량만큼 이동해서 이음매가 안 보인다 — 간격을 바깥
트랙에 주면 두 벌 사이에만 여분의 간격이 끼어들어 폭이 안 맞고, 매 반복마다 살짝 튀는
게 눈에 보이게 된다.

- [ ] **Step 2: 타입체크**

Run: `npm run build`
Expected: 컴파일 성공.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/AnnouncementTicker.tsx
git commit -m "Add AnnouncementTicker component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: 메인 페이지에 공지 섹션 배치

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: import와 데이터 fetch 추가**

```tsx
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Layers, Shield } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "admin";
  const showRegisterCta = !session || isAdmin;
  const registerHref = session ? "/technique/new" : "/auth/signup";

  return (
    <div className="flex flex-col w-full">
```

를 다음으로 교체:

```tsx
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Layers, Shield } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRecentlyUpdatedTechniques } from "@/lib/technique-service";
import { AnnouncementTicker } from "@/components/home/AnnouncementTicker";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "admin";
  const showRegisterCta = !session || isAdmin;
  const registerHref = session ? "/technique/new" : "/auth/signup";
  const recentlyUpdated = await getRecentlyUpdatedTechniques();

  return (
    <div className="flex flex-col w-full">
      <AnnouncementTicker items={recentlyUpdated} />
```

- [ ] **Step 2: 타입체크**

Run: `npm run build`
Expected: 컴파일 성공.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "Show recently-updated announcement ticker on the home page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: 사이드바 배지 + 최근수정 정렬

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: import와 interface에 필드 추가**

```tsx
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Search, ArrowUp, ArrowDown, Settings, Check } from 'lucide-react';

interface Technique {
  _id: string;
  name: { ko: string; en?: string };
  slug: string;
  parentId?: string;
  pathSlugs: string[];
  children?: Technique[];
  order?: number;
}
```

를 다음으로 교체:

```tsx
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Search, ArrowUp, ArrowDown, Settings, Check } from 'lucide-react';
import { isWithinRecentWindow } from '@/lib/recent-update';

interface Technique {
  _id: string;
  name: { ko: string; en?: string };
  slug: string;
  parentId?: string;
  pathSlugs: string[];
  children?: Technique[];
  order?: number;
  contentUpdatedAt?: string | null;
}

// 형제 목록 내에서 "최근 3일 이내 수정된" 항목만 원래 순서를 유지한 채 맨 앞으로
// 옮긴다. 나머지(비-최근) 항목들의 상대 순서는 그대로 유지되므로 관리자가
// "순서 편집"으로 설정한 커스텀 순서를 해치지 않는다.
function sortByRecency(nodes: Technique[]): Technique[] {
  const recent = nodes.filter((n) => isWithinRecentWindow(n.contentUpdatedAt));
  const rest = nodes.filter((n) => !isWithinRecentWindow(n.contentUpdatedAt));
  return [...recent, ...rest];
}
```

- [ ] **Step 2: 배지 삽입 (텍스트 왼쪽)**

```tsx
          <Link
            href={href}
            onClick={() => {
              // Only close sidebar if it's a leaf node (no children)
              if (!hasChildren) {
                onLinkClick?.();
              }
              // Only toggle if it has children, otherwise just navigate
              if (hasChildren) {
                expandNode(node);
              }
            }}
            className={cn(
              "flex-1 text-sm truncate transition-colors",
              isActive ? "text-accent" : ""
            )}
          >
            {node.name.ko}
          </Link>
```

를 다음으로 교체:

```tsx
          {isWithinRecentWindow(node.contentUpdatedAt) && (
            <span className="mr-1.5 h-2 w-2 shrink-0 rounded-full bg-yellow-400" />
          )}

          <Link
            href={href}
            onClick={() => {
              // Only close sidebar if it's a leaf node (no children)
              if (!hasChildren) {
                onLinkClick?.();
              }
              // Only toggle if it has children, otherwise just navigate
              if (hasChildren) {
                expandNode(node);
              }
            }}
            className={cn(
              "flex-1 text-sm truncate transition-colors",
              isActive ? "text-accent" : ""
            )}
          >
            {node.name.ko}
          </Link>
```

- [ ] **Step 3: 하위 목록 렌더링에 정렬 적용**

```tsx
        {hasChildren && isExpanded && (
          <div className="border-l border-border/30 ml-4 pl-1">
            {node.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
```

를 다음으로 교체:

```tsx
        {hasChildren && isExpanded && (
          <div className="border-l border-border/30 ml-4 pl-1">
            {sortByRecency(node.children!).map(child => renderNode(child, depth + 1))}
          </div>
        )}
```

- [ ] **Step 4: 루트 목록 렌더링에 정렬 적용**

```tsx
        <nav className="w-full space-y-1 pb-40">
          {tree.map(node => renderNode(node))}

          {tree.length === 0 && (
```

를 다음으로 교체:

```tsx
        <nav className="w-full space-y-1 pb-40">
          {sortByRecency(tree).map(node => renderNode(node))}

          {tree.length === 0 && (
```

- [ ] **Step 5: 타입체크**

Run: `npm run build`
Expected: 컴파일 성공.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "Add recency badge and top-of-list sort to sidebar tree

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: 브라우저 통합 검증

**Files:** 없음 (검증 전용 태스크)

- [ ] **Step 1: 린트 + 빌드 최종 확인**

Run: `npm run lint && npm run build`
Expected: 둘 다 에러 없이 통과.

- [ ] **Step 2: 개발 서버 기동 및 로그인**

`preview_start`로 dev 서버를 띄운다 (`.claude/launch.json`에 `dev` 설정이
없으면 `{"name": "dev", "runtimeExecutable": "npm", "runtimeArgs": ["run",
"dev"], "port": 3000}`으로 하나 만든 뒤 실행). 관리자 계정으로 로그인한다.

- [ ] **Step 3: 게시자/수정자 노출 확인**

기존 기술 하나를 관리자 권한으로 수정 저장한 뒤, 해당 기술 상세 페이지로
이동해 footer에 "최종 수정: {날짜} · 게시자: {닉네임} · 수정자: {닉네임}"이
표시되는지 `read_page` 또는 `get_page_text`로 확인한다. 수정한 적 없는 다른
(레거시) 기술 페이지는 게시자/수정자 문구 없이도 깨지지 않는지 확인한다.

- [ ] **Step 4: 사이드바 배지/정렬 확인**

방금 수정한 기술이 사이드바에서 노란 배지와 함께 형제 그룹 맨 위에 오는지
확인한다. 이어서 사이드바 "순서 편집"으로 형제 순서만 한 번 바꿔보고,
그로 인해 다른 형제들에 배지가 새로 생기지 않는지 확인한다 (회귀 확인).

- [ ] **Step 5: 메인 페이지 공지 섹션 확인**

메인 페이지로 이동해 방금 수정한 기술이 공지 섹션에 노출되는지 확인한다.
`read_console_messages`로 콘솔 에러가 없는지 확인하고, `computer`
스크린샷으로 한 줄 레이아웃과(항목이 여러 개면) 스크롤 애니메이션이 보이는지
확인한다.

- [ ] **Step 6: 최종 스크린샷 공유**

`computer {action: "screenshot"}`으로 메인 페이지, 사이드바, 기술 상세 footer
세 곳의 스크린샷을 남긴다.

(이 태스크는 코드 변경이 없으므로 커밋하지 않는다.)
