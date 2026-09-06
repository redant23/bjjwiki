# User 모델 및 관리자 권한 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DB 기반 User 계정 체계를 도입하고, 기술 등록/수정/삭제 및 관리자 기능을 `role: 'admin'`인 사용자만 사용할 수 있도록 제한한다.

**Architecture:** NextAuth `CredentialsProvider`의 `authorize()`를 `.env` 값 비교에서 MongoDB `User` 컬렉션 조회 + bcrypt 검증으로 교체하고, `src/lib/auth.ts`의 `requireAdmin()` 헬퍼를 모든 쓰기(mutating) API 라우트 시작 부분에서 호출해 세션이 없으면 401, admin이 아니면 403을 반환한다. 관리자 계정은 `ADMIN_EMAIL`과 일치하는 이메일로 회원가입하면 자동으로 생성된다.

**Tech Stack:** Next.js 16 App Router, NextAuth v4 (`next-auth@^4.24.13`), Mongoose 9, `bcryptjs`(신규).

**테스트 방법에 대한 메모:** 이 저장소에는 현재 테스트 프레임워크가 전혀 없다(jest/vitest 등 미설치, 기존 테스트 파일 없음). 이번 작업만을 위해 테스트 인프라(예: `mongodb-memory-server`)를 새로 들여오는 것은 승인된 스펙 범위를 벗어난다. 대신 각 태스크마다 **개발 서버를 띄운 상태에서 `curl`과 브라우저로 직접 검증**하는 절차를 명시한다. 특히 "세션이 없으면 401" 같은 경로는 `curl`만으로 확인 가능하고, "로그인 후 실제로 되는지"는 브라우저로 확인한다.

---

## Task 1: NextAuth 타입 확장

세션/JWT에 `role`, `id`를 추가하기 전에 타입부터 선언해서, 이후 태스크에서 `session.user.role`을 타입 캐스팅 없이 쓸 수 있게 한다.

**Files:**
- Create: `src/types/next-auth.d.ts`

- [ ] **Step 1: 타입 선언 파일 작성**

```typescript
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'user' | 'admin';
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: 'user' | 'admin';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'user' | 'admin';
  }
}
```

- [ ] **Step 2: 타입체크로 파일이 인식되는지 확인**

Run: `npx tsc --noEmit`
Expected: 기존에 있던 에러 외에 이 파일 관련 에러 없음 (이 시점엔 아직 아무도 `role`을 안 쓰므로 에러 자체가 없어야 정상).

- [ ] **Step 3: Commit**

```bash
git add src/types/next-auth.d.ts
git commit -m "$(cat <<'EOF'
Add NextAuth type augmentation for role and id

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: authOptions 분리 + requireAdmin 가드 + 아키텍처 검증

가장 위험한 가정(App Router 라우트 핸들러 안에서 `getServerSession(authOptions)`가 이 NextAuth v4 + Next 16 조합에서 실제로 세션과 `role`을 돌려주는가)을 제일 먼저 검증한다. 이 태스크에서는 `authorize()` 로직 자체는 건드리지 않고(여전히 `.env` 값과 비교), 위치만 옮기고 가드 하나만 실제로 걸어본다.

**Files:**
- Create: `src/lib/auth.ts`
- Modify: `src/app/api/auth/[...nextauth]/route.ts`
- Modify: `src/app/api/techniques/route.ts`

- [ ] **Step 1: authOptions와 requireAdmin을 lib/auth.ts로 작성**

```typescript
import { NextAuthOptions, getServerSession, Session } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { NextResponse } from 'next/server';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Login',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'admin@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

        if (
          credentials?.email === adminEmail &&
          credentials?.password === adminPassword
        ) {
          return { id: '1', name: 'Admin', email: adminEmail, role: 'admin' };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.id = token.id;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
};

export async function requireAdmin(): Promise<{ session: Session | null; error: NextResponse | null }> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    };
  }

  if (session.user.role !== 'admin') {
    return {
      session: null,
      error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { session, error: null };
}
```

- [ ] **Step 2: `[...nextauth]/route.ts`가 lib/auth.ts를 사용하도록 축소**

`src/app/api/auth/[...nextauth]/route.ts` 전체를 다음으로 교체:

```typescript
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

- [ ] **Step 3: `POST /api/techniques`에 가드 하나만 걸어서 검증용으로 사용**

`src/app/api/techniques/route.ts` 상단 import에 추가:

```typescript
import { requireAdmin } from '@/lib/auth';
```

`export async function POST(request: Request) {` 바로 다음 줄, `try {` 블록 맨 처음에 추가:

```typescript
export async function POST(request: Request) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
```

(기존의 `const ip = ...` 이하 코드는 그대로 유지)

- [ ] **Step 4: 개발 서버 실행**

Run: `npm run dev` (백그라운드로 실행하고 `http://localhost:3000`이 뜰 때까지 대기)

- [ ] **Step 5: 비로그인 상태에서 401이 오는지 curl로 확인**

Run:
```bash
curl -i -X POST http://localhost:3000/api/techniques \
  -H "Content-Type: application/json" \
  -d '{"name":{"ko":"테스트"},"description":{"ko":"테스트"},"primaryRole":"position"}'
```
Expected: 첫 줄이 `HTTP/1.1 401`이고, 바디에 `{"success":false,"error":"Unauthorized"}` 포함.

- [ ] **Step 6: 로그인 후에는 통과하는지 브라우저로 확인**

브라우저로 `http://localhost:3000/auth/signin` 접속 → `.env.local`의 `ADMIN_EMAIL`과 `ADMIN_PASSWORD`(미설정 시 기본값 `admin123`)로 로그인 → `http://localhost:3000/technique/new`에서 기술명(한글)만 채워서 "기술 등록하기" 제출.
Expected: 에러 없이 새로 만들어진 기술 상세 페이지로 리다이렉트됨 (즉 `requireAdmin()`이 로그인 세션에서 `role: 'admin'`을 정상적으로 읽어 통과시킴). 이 단계가 실패하면(예: 세션은 있는데 role이 undefined로 나옴) 이후 태스크로 넘어가지 말고 `requireAdmin`/콜백 구현을 다시 점검한다.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/\[...nextauth\]/route.ts src/app/api/techniques/route.ts
git commit -m "$(cat <<'EOF'
Extract NextAuth options and add requireAdmin guard

Relocates NextAuthOptions to src/lib/auth.ts so other route handlers
can call getServerSession(authOptions), and adds a requireAdmin()
helper. Wired into POST /api/techniques as a smoke test before the
DB-backed login change.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: User 모델

**Files:**
- Create: `src/models/User.ts`

- [ ] **Step 1: 모델 작성**

```typescript
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserCombo {
  name: string;
  techniques: mongoose.Types.ObjectId[];
}

export interface IUser extends Document {
  email: string;
  password: string;
  nickname: string;
  role: 'user' | 'admin';
  level: 'white' | 'blue' | 'purple' | 'brown' | 'black';
  stripe: number;
  period?: Date;
  mySkills: mongoose.Types.ObjectId[];
  myCombo: IUserCombo[];
  createdAt: Date;
  updatedAt: Date;
}

const ComboSchema = new Schema<IUserCombo>(
  {
    name: { type: String, required: true },
    techniques: [{ type: Schema.Types.ObjectId, ref: 'Technique' }],
  },
  { _id: true }
);

const UserSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, select: false },
    nickname: { type: String, required: true, unique: true, trim: true },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      index: true,
    },
    level: {
      type: String,
      enum: ['white', 'blue', 'purple', 'brown', 'black'],
      default: 'white',
    },
    stripe: { type: Number, min: 0, max: 4, default: 0 },
    period: { type: Date },
    mySkills: [{ type: Schema.Types.ObjectId, ref: 'Technique' }],
    myCombo: { type: [ComboSchema], default: [] },
  },
  { timestamps: true }
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
```

- [ ] **Step 2: 개발 서버에서 모델이 로드되는지 확인**

Run: `npx tsc --noEmit`
Expected: `src/models/User.ts` 관련 타입 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add src/models/User.ts
git commit -m "$(cat <<'EOF'
Add User model with auth, belt, and skill/combo fields

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: bcryptjs 의존성 추가

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: 설치**

Run: `npm install bcryptjs`

- [ ] **Step 2: 타입이 번들되어 있는지 확인**

Run: `node -e "console.log(require.resolve('bcryptjs/package.json'))" && cat $(node -e "console.log(require('path').dirname(require.resolve('bcryptjs/package.json')))")/package.json | grep -E '"types"|"typings"'`

- 출력에 `"types"` 또는 `"typings"` 필드가 있으면 타입이 번들된 것 → 다음 단계 생략.
- 아무 출력도 없으면 타입이 없는 것 → `npm install --save-dev @types/bcryptjs` 실행.

- [ ] **Step 3: import 되는지 간단히 확인**

Run: `node -e "const b = require('bcryptjs'); b.hash('test', 10).then(h => console.log(typeof h))"`
Expected: `string`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
Add bcryptjs dependency for password hashing

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 회원가입 API

**Files:**
- Create: `src/app/api/auth/signup/route.ts`

- [ ] **Step 1: 라우트 작성**

```typescript
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import User from '@/models/User';

export async function POST(request: Request) {
  try {
    const { email, password, nickname } = await request.json();

    if (!email || !password || !nickname) {
      return NextResponse.json(
        { success: false, error: 'email, password, nickname은 필수입니다.' },
        { status: 400 }
      );
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { success: false, error: '비밀번호는 최소 8자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    await dbConnect();

    const normalizedEmail = String(email).toLowerCase().trim();
    const hashedPassword = await bcrypt.hash(password, 10);
    const role =
      process.env.ADMIN_EMAIL &&
      normalizedEmail === process.env.ADMIN_EMAIL.toLowerCase().trim()
        ? 'admin'
        : 'user';

    const user = await User.create({
      email: normalizedEmail,
      password: hashedPassword,
      nickname,
      role,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: user._id,
          email: user.email,
          nickname: user.nickname,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    ) {
      return NextResponse.json(
        { success: false, error: '이미 사용 중인 이메일 또는 닉네임입니다.' },
        { status: 409 }
      );
    }
    console.error('Signup error:', error);
    return NextResponse.json(
      { success: false, error: '회원가입에 실패했습니다.' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 정상 가입 확인 (curl)**

`.env.local`의 `ADMIN_EMAIL` 값을 확인한 뒤(`grep ADMIN_EMAIL .env.local`), 그 이메일로 가입해서 admin이 되는지 확인:

```bash
curl -i -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"<ADMIN_EMAIL 값>","password":"testpass123","nickname":"관리자"}'
```
Expected: `HTTP/1.1 201`, 응답 바디의 `data.role`이 `"admin"`.

- [ ] **Step 3: 다른 이메일로 가입 시 일반 유저가 되는지 확인**

```bash
curl -i -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"tester@example.com","password":"testpass123","nickname":"테스터"}'
```
Expected: `HTTP/1.1 201`, `data.role`이 `"user"`.

- [ ] **Step 4: 중복 가입 시 409가 오는지 확인**

Step 3과 동일한 요청을 한 번 더 보낸다.
Expected: `HTTP/1.1 409`, `{"success":false,"error":"이미 사용 중인 이메일 또는 닉네임입니다."}`.

- [ ] **Step 5: 짧은 비밀번호가 거부되는지 확인**

```bash
curl -i -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"short@example.com","password":"123","nickname":"짧은유저"}'
```
Expected: `HTTP/1.1 400`

- [ ] **Step 6: Commit**

```bash
git add src/app/api/auth/signup/route.ts
git commit -m "$(cat <<'EOF'
Add signup API with admin-email bootstrap

Signing up with the email matching ADMIN_EMAIL grants role:admin;
everyone else gets role:user. Duplicate email/nickname returns 409.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 회원가입 페이지 + 로그인 페이지 링크

**Files:**
- Create: `src/app/auth/signup/page.tsx`
- Modify: `src/app/auth/signin/page.tsx`

- [ ] **Step 1: 회원가입 페이지 작성**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignUp() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nickname }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || '회원가입에 실패했습니다.');
        return;
      }

      router.push('/auth/signin');
    } catch {
      setError('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <div className="mx-auto w-full max-w-sm space-y-6 p-6 border rounded-lg shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">회원가입</h1>
          <p className="text-gray-500 dark:text-gray-400">
            BJJ Wiki 계정을 만드세요
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="nickname">Nickname</label>
            <input
              id="nickname"
              type="text"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? '가입 중...' : 'Sign Up'}
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          이미 계정이 있나요?{' '}
          <Link href="/auth/signin" className="underline hover:text-foreground">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 로그인 페이지에 회원가입 링크 추가**

`src/app/auth/signin/page.tsx`의 `</form>` 바로 다음에 추가:

```tsx
        </form>
        <p className="text-center text-sm text-muted-foreground">
          계정이 없나요?{' '}
          <Link href="/auth/signup" className="underline hover:text-foreground">
            회원가입
          </Link>
        </p>
      </div>
```

이 파일 상단 import에 `Link`가 없으므로 추가:

```tsx
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
```

- [ ] **Step 3: 브라우저로 가입 → 로그인 흐름 확인**

`http://localhost:3000/auth/signup`에서 새 계정 생성 → 자동으로 `/auth/signin`으로 이동하는지 확인 → 방금 만든 계정으로 로그인 시도.
Expected: 가입/로그인 페이지 간 링크가 정상 작동하고, 폼 제출 후 리다이렉트됨.

- [ ] **Step 4: Commit**

```bash
git add src/app/auth/signup/page.tsx src/app/auth/signin/page.tsx
git commit -m "$(cat <<'EOF'
Add signup page and link it from signin

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 로그인을 DB 기반으로 전환

이 태스크 이후로는 `.env`의 `ADMIN_EMAIL`/`ADMIN_PASSWORD`로 직접 로그인할 수 없다. `ADMIN_EMAIL`로 회원가입(Task 5/6)해서 만든 DB 계정으로 로그인해야 한다.

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: `authorize()`를 DB 조회 + bcrypt 검증으로 교체**

`src/lib/auth.ts` 상단 import에 추가:

```typescript
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import User from '@/models/User';
```

`authorize` 함수 전체를 다음으로 교체:

```typescript
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        await dbConnect();

        const user = await User.findOne({
          email: credentials.email.toLowerCase().trim(),
        }).select('+password');

        if (!user) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          return null;
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.nickname,
          role: user.role,
        };
      },
```

- [ ] **Step 2: 기존 브라우저 세션 로그아웃**

브라우저에서 `http://localhost:3000/admin`으로 이동해 "Logout" 클릭 (이전 태스크의 env 기반 admin 세션 쿠키를 지우기 위함).

- [ ] **Step 3: DB 관리자 계정으로 로그인되는지 확인**

`http://localhost:3000/auth/signin`에서 Task 5 Step 2에서 만든 `ADMIN_EMAIL` 계정(비밀번호 `testpass123`)으로 로그인.
Expected: 로그인 성공 후 `/admin`으로 이동.

- [ ] **Step 4: 일반 유저 계정으로는 기술 등록이 막히는지 확인**

로그아웃 후 Task 5 Step 3에서 만든 `tester@example.com` 계정(비밀번호 `testpass123`)으로 로그인 → `/technique/new`에서 기술 등록 시도.
Expected: 제출 시 에러 메시지 표시 (API가 403을 반환). 아직 UI 버튼 자체를 숨기지는 않았으므로 페이지 접근은 되지만 제출은 실패해야 정상.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts
git commit -m "$(cat <<'EOF'
Switch login to DB-backed User lookup with bcrypt

Replaces the .env credential comparison with a User collection query
and bcrypt.compare. The env-based admin login stops working from
this point; sign up with ADMIN_EMAIL to get a DB admin account.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 나머지 관리자 전용 라우트에 가드 적용

**Files:**
- Modify: `src/app/api/techniques/[id]/route.ts`
- Modify: `src/app/api/techniques/reorder/route.ts`
- Modify: `src/app/api/admin/approve/route.ts`
- Modify: `src/app/api/admin/reject/route.ts`
- Modify: `src/app/api/admin/seed-categories/route.ts`
- Modify: `src/app/api/admin/sync-children/route.ts`
- Modify: `src/app/api/upload/route.ts`

- [ ] **Step 1: `techniques/[id]/route.ts`의 PUT/DELETE에 가드 추가**

상단 import에 추가:

```typescript
import { requireAdmin } from '@/lib/auth';
```

`PUT` 함수의 `try {` 블록 맨 처음(`await dbConnect();` 이전)에 추가:

```typescript
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    await dbConnect();
    const body = await request.json();
```

`DELETE` 함수의 `try {` 블록 맨 처음(`await dbConnect();` 이전)에 동일하게 추가:

```typescript
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    await dbConnect();
    const id = params.id;
```

(GET 함수는 그대로 둔다 — 공개 열람 유지)

- [ ] **Step 2: `techniques/reorder/route.ts`의 PUT에 가드 추가**

상단 import 추가:

```typescript
import { requireAdmin } from '@/lib/auth';
```

`try {` 블록 맨 처음에 추가:

```typescript
export async function PUT(request: Request) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    await dbConnect();
```

- [ ] **Step 3: `admin/approve/route.ts` 전체 교체**

```typescript
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';
import { requireAdmin } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    await dbConnect();
    const { id } = await request.json();

    const technique = await Technique.findByIdAndUpdate(
      id,
      { status: 'approved', is_current_version: true },
      { new: true }
    );

    if (!technique) {
      return NextResponse.json({ error: 'Technique not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: technique });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to approve technique' },
      { status: 500 }
    );
  }
}
```

(`status: 'approved'`/`is_current_version`이 `Technique` 스키마와 맞지 않는 기존 버그는 이번 작업 범위가 아니므로 그대로 둔다.)

- [ ] **Step 4: `admin/reject/route.ts` 전체 교체**

```typescript
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';
import { requireAdmin } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    await dbConnect();
    const { id } = await request.json();

    const technique = await Technique.findByIdAndDelete(id);

    if (!technique) {
      return NextResponse.json({ error: 'Technique not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Technique rejected and deleted' });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to reject technique' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 5: `admin/seed-categories/route.ts`에 가드 추가**

상단 import 추가:

```typescript
import { requireAdmin } from '@/lib/auth';
```

`export async function GET() {` 의 `try {` 블록 맨 처음에 추가:

```typescript
export async function GET() {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    await dbConnect();
```

- [ ] **Step 6: `admin/sync-children/route.ts`에 가드 추가**

상단 import 추가:

```typescript
import { requireAdmin } from '@/lib/auth';
```

`export async function GET() {` 의 `try {` 블록 맨 처음에 추가:

```typescript
export async function GET() {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    await dbConnect();
```

- [ ] **Step 7: `upload/route.ts`에 가드 추가 + uploaderType을 세션에서 가져오도록 수정**

상단 import 추가:

```typescript
import { requireAdmin } from '@/lib/auth';
```

`POST` 함수 시작 부분을 다음으로 교체:

```typescript
export async function POST(request: NextRequest) {
  try {
    const { session, error: authError } = await requireAdmin();
    if (authError) return authError;

    await dbConnect();
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const usage = formData.get('usage') as string;
    const uploaderType = session!.user.role;
```

(`// TODO: Get from session when auth is implemented` 주석 줄은 삭제)

- [ ] **Step 8: 개발 서버 재시작 후 관리자 계정으로 전체 흐름 확인**

관리자 계정으로 로그인한 상태에서:
```bash
# 세션 쿠키가 필요한 브라우저 흐름이므로, /technique/new에서 실제 폼 제출로 확인
```
브라우저에서 `/technique/new`로 새 기술 하나 등록(썸네일 이미지도 하나 첨부해서 업로드 경로까지 확인) → 성공하는지 확인. 등록된 기술의 상세 페이지에서 수정/삭제가 필요하면 해당 UI가 있는 경우 시도(없다면 이 프로젝트에는 아직 수정/삭제 UI가 없을 수 있음 — 그 경우 `curl`로 세션 쿠키를 넣어 확인하거나 다음 curl로 삭제만 확인):

```bash
curl -i -X DELETE http://localhost:3000/api/techniques/<방금 만든 기술의 _id> \
  -H "Cookie: <브라우저 개발자도구에서 복사한 next-auth.session-token 쿠키>"
```
Expected: `HTTP/1.1 200`.

- [ ] **Step 9: 일반 유저 계정으로 각 라우트가 막히는지 확인**

일반 유저로 로그인한 세션 쿠키로:
```bash
curl -i -X PUT http://localhost:3000/api/techniques/reorder \
  -H "Content-Type: application/json" \
  -H "Cookie: <일반 유저 세션 쿠키>" \
  -d '{"items":[]}'
```
Expected: `HTTP/1.1 403`.

동일하게 `/api/admin/approve`, `/api/admin/reject`, `/api/admin/seed-categories`(GET), `/api/admin/sync-children`(GET), `/api/upload`(POST)도 일반 유저 쿠키로 호출했을 때 403이 오는지 확인.

- [ ] **Step 10: Commit**

```bash
git add src/app/api/techniques/\[id\]/route.ts src/app/api/techniques/reorder/route.ts src/app/api/admin/approve/route.ts src/app/api/admin/reject/route.ts src/app/api/admin/seed-categories/route.ts src/app/api/admin/sync-children/route.ts src/app/api/upload/route.ts
git commit -m "$(cat <<'EOF'
Gate remaining mutating routes behind requireAdmin

Covers technique update/delete/reorder, admin approve/reject,
seed-categories, sync-children, and the upload endpoint (which had a
TODO for exactly this since auth wasn't implemented yet).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: UI 반영 (등록 버튼 숨김 + 접근 리다이렉트)

**Files:**
- Modify: `src/components/layout/NavbarClient.tsx`
- Modify: `src/app/technique/new/page.tsx`

- [ ] **Step 1: NavbarClient에서 관리자만 등록 버튼을 보게 함**

상단 import에 추가:

```tsx
import { useSession } from 'next-auth/react';
```

컴포넌트 내부, `const { theme, setTheme } = useTheme();` 다음 줄에 추가:

```tsx
  const { data: session } = useSession();
```

등록 버튼 부분을 다음과 같이 조건부 렌더링으로 교체:

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

- [ ] **Step 2: `/technique/new`에서 비관리자를 홈으로 리다이렉트**

상단 import에 추가:

```tsx
import { useSession } from 'next-auth/react';
```

컴포넌트 최상단, `const router = useRouter();` 다음 줄에 추가:

```tsx
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== 'loading' && session?.user?.role !== 'admin') {
      router.push('/');
    }
  }, [status, session, router]);

  if (status === 'loading') {
    return <div className="p-8">Loading...</div>;
  }

  if (session?.user?.role !== 'admin') {
    return null;
  }
```

이 코드는 기존 `const [loading, setLoading] = useState(false);` 등 다른 `useState` 선언들보다 먼저 와도 상관없다(React hooks 순서 규칙상 조건문 없이 최상단에 있으면 됨).

- [ ] **Step 3: 브라우저로 확인**

- 로그아웃 상태 또는 일반 유저로 로그인한 상태에서 네비게이션 바에 "기술 등록" 버튼이 보이지 않는지 확인.
- 같은 상태에서 주소창에 직접 `http://localhost:3000/technique/new`를 입력해 접근 시 즉시 `/`로 리다이렉트되는지 확인.
- 관리자로 로그인한 상태에서는 버튼이 보이고, `/technique/new` 접근도 정상적으로 되는지 확인.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/NavbarClient.tsx src/app/technique/new/page.tsx
git commit -m "$(cat <<'EOF'
Hide technique-register UI from non-admins

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: 전체 흐름 최종 확인

새로운 코드를 추가하지 않고, 지금까지의 변경이 하나의 흐름으로 맞물려 동작하는지 마지막으로 확인하는 태스크.

**Files:** (없음 — 검증만)

- [ ] **Step 1: 타입/빌드 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

Run: `npm run build`
Expected: 빌드 성공.

- [ ] **Step 2: 처음부터 끝까지 시나리오 재확인**

1. 새 브라우저 시크릿 창으로 `/auth/signup`에서 새 계정 가입 (관리자 이메일 아님).
2. 로그인 후 `/`에 "기술 등록" 버튼이 안 보이는지 확인.
3. `/technique/new` 직접 접근 시 `/`로 튕기는지 확인.
4. 로그아웃 후 관리자 계정(ADMIN_EMAIL로 가입한 계정)으로 로그인.
5. "기술 등록" 버튼이 보이고, 기술 하나를 실제로 등록/조회할 수 있는지 확인.
6. `/admin`에서 로그인 상태가 정상 표시되는지 확인.

Expected: 6단계 모두 설계 의도대로 동작.

- [ ] **Step 3: 최종 커밋 (필요한 경우)**

이 태스크에서 코드 변경이 없었다면 커밋할 것도 없다. 검증 중 발견된 문제를 고쳤다면 그 수정 사항을 커밋한다.
