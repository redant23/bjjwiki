# 네비게이션바 로그인 상태 표시 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 네비게이션바에서 로그인 상태(로그인/로그아웃/내 정보)를 확인할 수 있게 하고, 비로그인 사용자가 "기술 등록" 버튼을 누르면 회원가입 페이지로 유도한다.

**Architecture:** 이미 세션을 다루고 있는 두 위치(`NavbarClient.tsx`의 `useSession()`, `page.tsx`의 `getServerSession()`)에 로그인 상태에 따른 분기를 추가한다. "내 정보"는 새 `GET /api/user/me` API로 현재 사용자 문서를 조회해 보여주는 읽기 전용 `/profile` 페이지로 구현한다.

**Tech Stack:** Next.js 16 App Router, NextAuth v4, Mongoose.

**테스트 방법에 대한 메모:** 이 저장소에는 테스트 프레임워크가 없다. 각 태스크는 개발 서버를 띄운 상태에서 `curl`(및 필요 시 렌더링된 HTML 검사)로 검증한다. 브라우저는 사용할 수 없다.

---

## Task 1: `GET /api/user/me` API

**Files:**
- Create: `src/app/api/user/me/route.ts`

- [ ] **Step 1: 라우트 작성**

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import User from '@/models/User';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await dbConnect();

    const user = await User.findById(session.user.id).select(
      'email nickname role level stripe period createdAt'
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        level: user.level,
        stripe: user.stripe,
        period: user.period,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('GET /api/user/me error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 비로그인 시 401 확인**

Run:
```bash
curl -i http://localhost:3000/api/user/me
```
Expected: `HTTP/1.1 401`, `{"success":false,"error":"Unauthorized"}`.

- [ ] **Step 3: 로그인 후 본인 정보가 오는지 확인**

NextAuth 자격 증명 로그인 플로우로 로그인(이전 작업들에서 쓰던 것과 동일한 패턴):
```bash
COOKIE_JAR=/tmp/task_userme_cookies.txt
rm -f "$COOKIE_JAR"
CSRF_JSON=$(curl -s -c "$COOKIE_JAR" http://localhost:3000/api/auth/csrf)
CSRF=$(node -e "console.log(JSON.parse(process.argv[1]).csrfToken)" "$CSRF_JSON")
curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "email=tester@example.com" \
  --data-urlencode "password=testpass123" \
  --data-urlencode "json=true"

curl -s -b "$COOKIE_JAR" http://localhost:3000/api/user/me
```
Expected: `{"success":true,"data":{"email":"tester@example.com","nickname":"테스터","role":"user","level":"white","stripe":0,...}}` — 응답에 `password` 필드가 없어야 한다.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/user/me/route.ts
git commit -m "$(cat <<'EOF'
Add GET /api/user/me for the current user's own profile

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `/profile` 페이지

**Files:**
- Create: `src/app/profile/page.tsx`

- [ ] **Step 1: 페이지 작성**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

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

export default function ProfilePage() {
  const router = useRouter();
  const { status } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');

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
          <div className="flex justify-between border-b pb-3">
            <span className="text-muted-foreground">닉네임</span>
            <span className="font-medium">{profile.nickname}</span>
          </div>
          <div className="flex justify-between border-b pb-3">
            <span className="text-muted-foreground">이메일</span>
            <span className="font-medium">{profile.email}</span>
          </div>
          <div className="flex justify-between border-b pb-3">
            <span className="text-muted-foreground">벨트 등급</span>
            <span className="font-medium">
              {LEVEL_LABELS[profile.level]} · 그랄 {profile.stripe}개
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">수련 시작일</span>
            <span className="font-medium">
              {profile.period ? new Date(profile.period).toLocaleDateString('ko-KR') : '미입력'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: hooks 순서 확인**

파일을 다시 읽고, 모든 훅(`useRouter`, `useSession`, `useState` x2, `useEffect` x2)이 두 개의 조건부 `return`보다 먼저, 조건 없이 호출되는지 확인한다.

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: curl로 확인**

Task 1에서 로그인한 쿠키(`/tmp/task_userme_cookies.txt`)를 재사용하거나 새로 로그인한다:
```bash
curl -s -b "$COOKIE_JAR" http://localhost:3000/profile | grep -o "내 정보"
```
Expected: `내 정보` 문자열이 SSR HTML에 존재(로딩 상태 div의 제목이 아니라 페이지 자체의 `<h1>`이므로 SSR에는 없을 수 있음 — 클라이언트 컴포넌트라 초기 HTML은 아무 데이터 없이 hooks 초기 상태로 렌더링됨. `curl`로는 `<div class="p-8">Loading...</div>` 정도만 확인 가능하다는 점을 감안하고, 실제 데이터 표시는 `GET /api/user/me`가 올바른 데이터를 반환하는지(Task 1에서 이미 검증됨)로 간접 확인한다).

비로그인 상태로 같은 요청을 보내면 SSR HTML에 로딩 화면만 나오고(리다이렉트는 클라이언트에서 발생) 실제 데이터는 없어야 한다 — Task 9의 `/technique/new` 검증과 동일한 패턴.

- [ ] **Step 5: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "$(cat <<'EOF'
Add read-only profile page at /profile

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 네비게이션바 — 로그인 상태 UI + 등록 버튼 분기

**Files:**
- Modify: `src/components/layout/NavbarClient.tsx`

- [ ] **Step 1: import에 `signOut` 추가, `useSession`에서 `status`도 가져오기**

`import { useSession } from 'next-auth/react';`를 다음으로 교체:
```tsx
import { useSession, signOut } from 'next-auth/react';
```

`const { data: session } = useSession();`를 다음으로 교체:
```tsx
  const { data: session, status } = useSession();
```

- [ ] **Step 2: 등록 버튼을 로그인 상태에 따라 분기**

기존 블록:
```tsx
            {session?.user?.role === 'admin' && (
              <Link
                href="/technique/new"
                className="inline-flex text-primary items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-accent text-accent-foreground hover:bg-accent/90 h-9 px-4 py-2"
              >
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">기술 등록</span>
                <span className="sm:hidden">등록</span>
              </Link>
            )}
```

다음으로 교체:
```tsx
            {(status === 'unauthenticated' ||
              (status === 'authenticated' && session?.user?.role === 'admin')) && (
              <Link
                href={status === 'unauthenticated' ? '/auth/signup' : '/technique/new'}
                className="inline-flex text-primary items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-accent text-accent-foreground hover:bg-accent/90 h-9 px-4 py-2"
              >
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">기술 등록</span>
                <span className="sm:hidden">등록</span>
              </Link>
            )}
```

- [ ] **Step 3: 로그인 상태 UI(로그인 / 내 정보+로그아웃) 추가**

바로 위에서 교체한 블록 다음(같은 `<div className="flex flex-1 items-center justify-end ...">` 안, 닫는 `</div>` 전)에 추가:

```tsx
            {status === 'authenticated' && (
              <>
                <Link
                  href="/profile"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground h-9 px-3"
                >
                  내 정보
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground h-9 px-3"
                >
                  로그아웃
                </button>
              </>
            )}
            {status === 'unauthenticated' && (
              <Link
                href="/auth/signin"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground h-9 px-3"
              >
                로그인
              </Link>
            )}
```

(`status === 'loading'`일 때는 두 블록 모두 조건에 해당하지 않으므로 자연스럽게 아무것도 렌더링되지 않는다 — 스펙의 "로딩 중 깜빡임 방지" 요구사항을 만족한다.)

- [ ] **Step 4: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 5: curl로 확인**

비로그인 상태:
```bash
curl -s http://localhost:3000/ | grep -o "기술 등록\|로그인\|내 정보\|로그아웃"
```
Expected: `기술 등록`은 나오고(회원가입 유도용 버튼으로 노출), `로그인`도 나오고, `내 정보`/`로그아웃`은 나오지 않아야 한다. (참고: `useSession`은 클라이언트에서 resolve되므로 `SessionProvider`에 세션이 주입되지 않는 이 프로젝트 구조상 SSR HTML은 `status: 'loading'` 기준으로 렌더링된다 — 즉 이 curl 검증은 "로딩 중 아무것도 안 보임"을 확인하는 것이고, 로그인 후 상태는 Task 9에서 이미 확립된 패턴대로 코드 리딩 + `/api/auth/session` 값으로 간접 검증한다. 실제로 무엇이 보이는지는 `status`가 `loading`이 아닌 시점 기준으로 코드를 재확인한다.)

관리자로 로그인한 세션 쿠키로 `/api/auth/session`을 호출해 `role: "admin"`을 확인하고, 코드상 `status === 'authenticated' && session.user.role === 'admin'`이면 등록 버튼이 `/technique/new`로, `내 정보`/`로그아웃`이 보이는 것을 코드 리딩으로 재확인한다. 일반 유저 세션에서는 등록 버튼이 보이지 않는 것을 코드 리딩으로 확인한다(로직상 `status === 'authenticated'`이고 `role !== 'admin'`이면 등록 버튼 조건이 거짓이 됨).

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/NavbarClient.tsx
git commit -m "$(cat <<'EOF'
Show login status in navbar, route logged-out register clicks to signup

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 홈페이지 등록 버튼 분기

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 등록 버튼 노출/링크 로직 변경**

기존:
```tsx
export default async function Home() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "admin";

  return (
```

다음으로 교체:
```tsx
export default async function Home() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "admin";
  const showRegisterCta = !session || isAdmin;
  const registerHref = session ? "/technique/new" : "/auth/signup";

  return (
```

기존 버튼 블록:
```tsx
              {isAdmin && (
                <Link
                  href="/technique/new"
                  className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-8 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                >
                  기술 등록하기
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              )}
```

다음으로 교체:
```tsx
              {showRegisterCta && (
                <Link
                  href={registerHref}
                  className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-8 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                >
                  기술 등록하기
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              )}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: curl로 3가지 상태 확인**

비로그인:
```bash
curl -s http://localhost:3000/ | grep -A2 "기술 등록하기" | grep -o 'href="[^"]*"' | head -1
```
Expected: `href="/auth/signup"`.

관리자 로그인 후 (Task 3에서 쓴 관리자 쿠키 재사용 가능):
```bash
curl -s -b "$ADMIN_COOKIE_JAR" http://localhost:3000/ | grep -A2 "기술 등록하기" | grep -o 'href="[^"]*"' | head -1
```
Expected: `href="/technique/new"`.

일반 유저 로그인 후:
```bash
curl -s -b "$USER_COOKIE_JAR" http://localhost:3000/ | grep -c "기술 등록하기"
```
Expected: `0` (버튼 자체가 없음).

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "$(cat <<'EOF'
Route logged-out homepage register CTA to signup

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
