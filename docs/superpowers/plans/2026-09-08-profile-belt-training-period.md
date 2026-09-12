# 내 정보 - 벨트 등급 / 수련 시작일 수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 프로필 페이지(`/profile`)에서 본인의 벨트 등급, 그랄 수, 수련 시작일을 직접 수정할 수 있게 하고, 수련 시작일로부터 "몇년차 / 총 며칠째"를 계산해 보여준다.

**Architecture:** `User` 모델의 `stripe` 필드 검증을 벨트별 최대 그랄 수(화이트~브라운 0-4, 블랙 0-6)를 반영하도록 고치고, `GET /api/user/me`가 있는 라우트 파일에 `PUT`을 추가해 본인 정보를 부분 업데이트할 수 있게 한다. 프로필 페이지에는 기술 상세 페이지와 동일한 "수정 모드 토글" UI를 추가한다.

**Tech Stack:** Next.js 16 App Router, Mongoose 9, NextAuth v4.

**테스트 방법에 대한 메모:** 테스트 프레임워크가 없다. 각 태스크는 개발 서버를 띄운 상태에서 `curl`로 API를 검증하고, UI 태스크는 코드 리딩 + `tsc --noEmit`으로 검증한다(브라우저 최종 확인은 컨트롤러가 한다). API curl 검증에는 기존 플랜들과 동일하게 `tester@example.com` / `testpass123` 테스트 계정 로그인 흐름을 재사용한다(계정이 없으면 회원가입 후 진행).

---

## Task 1: User 모델 — `stripe` 검증을 벨트별 최대치로 변경

**Files:**
- Modify: `src/models/User.ts`

- [ ] **Step 1: `MAX_STRIPES_BY_LEVEL` 추가**

`export interface IUser extends Document {` ~ 닫는 `}` 블록 바로 다음, `const UserSkillSchema = new Schema<IUserSkill>(` 바로 앞에 추가:

```typescript
export const MAX_STRIPES_BY_LEVEL: Record<IUser['level'], number> = {
  white: 4,
  blue: 4,
  purple: 4,
  brown: 4,
  black: 6,
};

```

- [ ] **Step 2: `stripe` 필드를 커스텀 validator로 교체**

`UserSchema` 안의 다음 줄:
```typescript
    stripe: { type: Number, min: 0, max: 4, default: 0 },
```
을 다음으로 교체:
```typescript
    stripe: {
      type: Number,
      min: 0,
      default: 0,
      validate: {
        validator: function (this: IUser, v: number) {
          return v <= MAX_STRIPES_BY_LEVEL[this.level];
        },
        message: '그랄 수가 벨트 등급의 최대치를 초과했습니다.',
      },
    },
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add src/models/User.ts
git commit -m "$(cat <<'EOF'
Allow black belt stripe count up to 6 in User model

The stripe field was hardcoded to max 4 for every belt, which can't
represent a black belt's 0-6 stripe range. Replace the static max
with a validator keyed on the user's level, and export
MAX_STRIPES_BY_LEVEL so the API and UI can reuse the same limits.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `PUT /api/user/me` — 벨트/그랄/수련시작일 수정

**Files:**
- Modify: `src/app/api/user/me/route.ts`

- [ ] **Step 1: import 추가**

파일 상단의 import 블록:
```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import User from '@/models/User';
```
을 다음으로 교체:
```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import User, { IUser, MAX_STRIPES_BY_LEVEL } from '@/models/User';

const VALID_LEVELS: IUser['level'][] = ['white', 'blue', 'purple', 'brown', 'black'];
```

- [ ] **Step 2: `PUT` 핸들러 추가**

파일 맨 끝(기존 `GET` 함수 다음)에 추가:

```typescript

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (body.level !== undefined && !VALID_LEVELS.includes(body.level)) {
      return NextResponse.json(
        { success: false, error: 'Invalid level value' },
        { status: 400 }
      );
    }

    if (
      body.stripe !== undefined &&
      (!Number.isInteger(body.stripe) || body.stripe < 0)
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid stripe value' },
        { status: 400 }
      );
    }

    let parsedPeriod: Date | undefined | null = null; // null = 변경 없음(sentinel)
    if (body.period !== undefined) {
      if (body.period === '' || body.period === null) {
        parsedPeriod = undefined;
      } else {
        const parsed = new Date(body.period);
        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json(
            { success: false, error: 'Invalid period value' },
            { status: 400 }
          );
        }
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        if (parsed.getTime() > endOfToday.getTime()) {
          return NextResponse.json(
            {
              success: false,
              error: '수련 시작일은 오늘보다 미래일 수 없습니다.',
            },
            { status: 400 }
          );
        }
        parsedPeriod = parsed;
      }
    }

    await dbConnect();

    const user = await User.findById(session.user.id);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const nextLevel: IUser['level'] =
      body.level !== undefined ? body.level : user.level;
    const maxStripe = MAX_STRIPES_BY_LEVEL[nextLevel];

    user.level = nextLevel;
    user.stripe =
      body.stripe !== undefined
        ? Math.min(body.stripe, maxStripe)
        : Math.min(user.stripe, maxStripe);

    if (body.period !== undefined) {
      user.period = parsedPeriod === null ? user.period : parsedPeriod;
    }

    await user.save();

    return NextResponse.json({
      success: true,
      data: {
        level: user.level,
        stripe: user.stripe,
        period: user.period,
      },
    });
  } catch (error) {
    console.error('PUT /api/user/me error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 개발 서버 기동 확인**

Run: `npm run dev` (백그라운드로 띄워두고 아래 curl 단계들을 같은 터미널 세션에서 순서대로 실행)

- [ ] **Step 5: 비로그인 401 확인**

```bash
curl -i -X PUT http://localhost:3000/api/user/me \
  -H "Content-Type: application/json" \
  -d '{"level":"blue"}'
```
Expected: `401`.

- [ ] **Step 6: 로그인**

```bash
COOKIE_JAR=/tmp/task_profile_edit.txt
rm -f "$COOKIE_JAR"
CSRF_JSON=$(curl -s -c "$COOKIE_JAR" http://localhost:3000/api/auth/csrf)
CSRF=$(node -e "console.log(JSON.parse(process.argv[1]).csrfToken)" "$CSRF_JSON")
curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "email=tester@example.com" \
  --data-urlencode "password=testpass123" \
  --data-urlencode "json=true"
```
(계정이 없으면 `/api/auth/signup`으로 먼저 만든 뒤 재시도.)

- [ ] **Step 7: 벨트/그랄/수련시작일 정상 업데이트 확인**

```bash
curl -s -b "$COOKIE_JAR" -X PUT http://localhost:3000/api/user/me \
  -H "Content-Type: application/json" \
  -d '{"level":"blue","stripe":2,"period":"2023-03-15"}'
```
Expected: `{"success":true,"data":{"level":"blue","stripe":2,"period":"2023-03-15T00:00:00.000Z"}}`.

- [ ] **Step 8: 부분 업데이트(level만 변경, stripe/period 유지) 확인**

```bash
curl -s -b "$COOKIE_JAR" -X PUT http://localhost:3000/api/user/me \
  -H "Content-Type: application/json" \
  -d '{"level":"purple"}'
curl -s -b "$COOKIE_JAR" http://localhost:3000/api/user/me
```
Expected: PUT 응답과 이어지는 GET 응답 모두 `level:"purple"`, `stripe:2`(그대로 유지), `period`는 Step 7 값 그대로.

- [ ] **Step 9: 그랄 초과 시 자동 clamp 확인 (퍼플 벨트에서 stripe 10 요청)**

```bash
curl -s -b "$COOKIE_JAR" -X PUT http://localhost:3000/api/user/me \
  -H "Content-Type: application/json" \
  -d '{"stripe":10}'
```
Expected: `{"success":true,"data":{"level":"purple","stripe":4, ...}}` (퍼플 최대치 4로 clamp됨).

- [ ] **Step 10: 블랙 벨트에서 그랄 6까지 허용되는지 확인**

```bash
curl -s -b "$COOKIE_JAR" -X PUT http://localhost:3000/api/user/me \
  -H "Content-Type: application/json" \
  -d '{"level":"black","stripe":6}'
```
Expected: `{"success":true,"data":{"level":"black","stripe":6, ...}}`.

- [ ] **Step 11: 블랙 → 퍼플로 되돌리면 그랄이 4로 자동 clamp되는지 확인 (level만 보내도 clamp)**

```bash
curl -s -b "$COOKIE_JAR" -X PUT http://localhost:3000/api/user/me \
  -H "Content-Type: application/json" \
  -d '{"level":"purple"}'
```
Expected: `{"success":true,"data":{"level":"purple","stripe":4, ...}}` (Step 10에서 6이었던 stripe가 4로 clamp).

- [ ] **Step 12: 잘못된 level 값 거부 확인**

```bash
curl -i -b "$COOKIE_JAR" -X PUT http://localhost:3000/api/user/me \
  -H "Content-Type: application/json" \
  -d '{"level":"red"}'
```
Expected: `400`.

- [ ] **Step 13: 미래 날짜 거부 확인**

```bash
curl -i -b "$COOKIE_JAR" -X PUT http://localhost:3000/api/user/me \
  -H "Content-Type: application/json" \
  -d '{"period":"2099-01-01"}'
```
Expected: `400`, `"수련 시작일은 오늘보다 미래일 수 없습니다."`.

- [ ] **Step 14: period를 빈 문자열로 보내면 미입력 상태로 되돌아가는지 확인**

```bash
curl -s -b "$COOKIE_JAR" -X PUT http://localhost:3000/api/user/me \
  -H "Content-Type: application/json" \
  -d '{"period":""}'
curl -s -b "$COOKIE_JAR" http://localhost:3000/api/user/me
```
Expected: 두 응답 모두 `period`가 `null`.

- [ ] **Step 15: Commit**

```bash
git add src/app/api/user/me/route.ts
git commit -m "$(cat <<'EOF'
Add PUT /api/user/me for self-editing belt level, stripe, and period

Partial update: level/stripe/period are all optional. Rejects an
unknown level, a non-integer/negative stripe, and a period later
than today. Stripe is clamped to the belt's max (4, or 6 for black)
whenever either field changes, so a black-belt-only stripe value
never survives a downgrade.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 프로필 페이지 — 수정 모드 + 수련 기간 표시

**Files:**
- Modify: `src/app/profile/page.tsx`

- [ ] **Step 1: 파일 전체를 다음 내용으로 교체**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Edit, Save, X } from 'lucide-react';

interface ProfileData {
  email: string;
  nickname: string;
  role: 'user' | 'admin';
  level: 'white' | 'blue' | 'purple' | 'brown' | 'black';
  stripe: number;
  period?: string;
  createdAt: string;
}

const LEVEL_LABELS: Record<ProfileData['level'], string> = {
  white: '화이트 벨트',
  blue: '블루 벨트',
  purple: '퍼플 벨트',
  brown: '브라운 벨트',
  black: '블랙 벨트',
};

const LEVEL_OPTIONS: ProfileData['level'][] = ['white', 'blue', 'purple', 'brown', 'black'];

const MAX_STRIPES_BY_LEVEL: Record<ProfileData['level'], number> = {
  white: 4,
  blue: 4,
  purple: 4,
  brown: 4,
  black: 6,
};

function toDateInputValue(period?: string): string {
  if (!period) return '';
  return period.slice(0, 10);
}

function getTrainingDuration(period: string): { years: number; days: number } {
  const start = new Date(period);
  const today = new Date();
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const years = todayMidnight.getFullYear() - startMidnight.getFullYear() + 1;
  const days = Math.floor((todayMidnight.getTime() - startMidnight.getTime()) / 86400000) + 1;
  return { years, days };
}

export default function ProfilePage() {
  const router = useRouter();
  const { status } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [editForm, setEditForm] = useState({
    level: 'white' as ProfileData['level'],
    stripe: 0,
    period: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    async function fetchProfile() {
      if (status !== 'authenticated') return;
      try {
        const res = await fetch('/api/user/me');
        const data = await res.json();
        if (data.success) {
          setProfile(data.data);
        } else {
          setError(data.error || '프로필을 불러오지 못했습니다.');
        }
      } catch {
        setError('오류가 발생했습니다.');
      }
    }
    fetchProfile();
  }, [status]);

  function handleEdit() {
    if (!profile) return;
    setEditForm({
      level: profile.level,
      stripe: profile.stripe,
      period: toDateInputValue(profile.period),
    });
    setSaveError('');
    setIsEditing(true);
  }

  function handleCancel() {
    setSaveError('');
    setIsEditing(false);
  }

  function handleLevelChange(level: ProfileData['level']) {
    setEditForm((prev) => ({
      ...prev,
      level,
      stripe: Math.min(prev.stripe, MAX_STRIPES_BY_LEVEL[level]),
    }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/user/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: editForm.level,
          stripe: editForm.stripe,
          period: editForm.period,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProfile((prev) =>
          prev
            ? { ...prev, level: data.data.level, stripe: data.data.stripe, period: data.data.period }
            : prev
        );
        setIsEditing(false);
      } else {
        setSaveError(data.error || '저장하지 못했습니다.');
      }
    } catch {
      setSaveError('오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading' || (status === 'authenticated' && !profile && !error)) {
    return <div className="p-8">Loading...</div>;
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <div className="container max-w-lg py-6 lg:py-10">
      <h1 className="text-3xl font-bold mb-6">내 정보</h1>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-md mb-6">
          {error}
        </div>
      )}

      {profile && (
        <div className="space-y-4 rounded-lg border p-6">
          {!isEditing && (
            <div className="flex justify-end">
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Edit className="h-3.5 w-3.5" />
                수정
              </button>
            </div>
          )}

          <div className="flex justify-between border-b pb-3">
            <span className="text-muted-foreground">닉네임</span>
            <span className="font-medium">{profile.nickname}</span>
          </div>
          <div className="flex justify-between border-b pb-3">
            <span className="text-muted-foreground">이메일</span>
            <span className="font-medium">{profile.email}</span>
          </div>

          {isEditing ? (
            <>
              <div className="space-y-2 border-b pb-3">
                <label className="block text-sm text-muted-foreground">벨트 등급</label>
                <select
                  value={editForm.level}
                  onChange={(e) => handleLevelChange(e.target.value as ProfileData['level'])}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {LEVEL_OPTIONS.map((level) => (
                    <option key={level} value={level}>
                      {LEVEL_LABELS[level]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 border-b pb-3">
                <label className="block text-sm text-muted-foreground">그랄</label>
                <select
                  value={editForm.stripe}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, stripe: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {Array.from({ length: MAX_STRIPES_BY_LEVEL[editForm.level] + 1 }, (_, n) => n).map((n) => (
                    <option key={n} value={n}>
                      {n}그랄
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-muted-foreground">수련 시작일</label>
                <input
                  type="date"
                  value={editForm.period}
                  max={toDateInputValue(new Date().toISOString())}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, period: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {saveError && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                  {saveError}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between border-b pb-3">
                <span className="text-muted-foreground">벨트 등급</span>
                <span className="font-medium">
                  {LEVEL_LABELS[profile.level]} · 그랄 {profile.stripe}개
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">수련 시작일</span>
                <span className="font-medium text-right">
                  {profile.period ? (
                    <>
                      {new Date(profile.period).toLocaleDateString('ko-KR')}
                      <br />
                      <span className="text-sm text-muted-foreground">
                        {(() => {
                          const { years, days } = getTrainingDuration(profile.period as string);
                          return `${years}년차 (총 ${days}일째)`;
                        })()}
                      </span>
                    </>
                  ) : (
                    '미입력'
                  )}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

**참고:** `MAX_STRIPES_BY_LEVEL`을 `src/models/User.ts`의 `MAX_STRIPES_BY_LEVEL`과 값은 동일하게 이 파일 안에 다시 선언한다(설계 문서는 모델에서 재사용한다고 했지만, 이 파일은 `'use client'` 컴포넌트라 mongoose를 임포트하는 모델 파일을 가져오면 안 된다 — 이 코드베이스의 다른 클라이언트 컴포넌트도 서버 모델을 직접 import하지 않고 자체 인터페이스/상수를 둔다, 예: `technique/[...slug]/page.tsx`의 `Technique` 인터페이스). 두 값이 어긋나지 않도록 Task 1과 값이 같은지 다시 확인한다.

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 브라우저로 최종 확인**

개발 서버를 띄운 채 브라우저에서 `tester@example.com`으로 로그인한 뒤 `/profile` 접속:
1. "수정" 버튼 클릭 → 벨트 select, 그랄 select, 수련시작일 date input이 나타나는지 확인.
2. 벨트를 "블랙 벨트"로 바꾸면 그랄 select 옵션이 0~6까지 늘어나는지 확인.
3. 그랄을 6으로 선택한 뒤 벨트를 "퍼플 벨트"로 바꾸면 그랄 select 값이 자동으로 4로 줄어드는지 확인.
4. 수련시작일을 과거 날짜(예: 3년 전)로 입력하고 저장 → 읽기 모드에서 "N년차 (총 M일째)"가 표시되는지, 날짜가 맞는지 확인.
5. 새로고침(F5) 후에도 저장된 값이 유지되는지 확인.
6. "수정" 버튼을 눌렀다가 값을 바꾸고 "취소"를 누르면 원래 값으로 돌아가는지 확인.

- [ ] **Step 4: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "$(cat <<'EOF'
Add belt/stripe/training-start-date editing to the profile page

Toggle-based edit mode (same pattern as the technique detail page):
a belt select, a stripe select whose range follows the selected
belt, and a date input for training start. Read mode now also shows
years-in and total-days-in, computed from the stored start date.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
