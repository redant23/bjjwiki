# 구글 로그인 및 비밀번호 재설정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 이메일/비밀번호 로그인에 구글 로그인을 추가하고, Resend 메일로 비밀번호를 재설정할 수 있게 한다.

**Architecture:** next-auth v4에 `GoogleProvider`를 추가하고, 구글 사용자 조회/생성/연결은 `src/lib/google-user.ts`로 분리해 `signIn`/`jwt` 콜백에서 호출한다. 재설정은 별도 `PasswordResetToken` 컬렉션(SHA-256 해시 저장, TTL 인덱스)과 두 API 라우트(`forgot-password`, `reset-password`), 두 화면으로 구성한다.

**Tech Stack:** Next.js 16 App Router, next-auth v4, Mongoose 9, bcryptjs, Resend(`resend` 패키지), Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-03-google-login-password-reset-design.md`

**테스트 방법에 대한 메모:** 이 저장소에는 테스트 프레임워크가 없고 도입하지 않는다. 각 태스크는 `npx tsc --noEmit`과 개발 서버 + `curl`로 검증한다. 구글 OAuth 흐름은 키가 있어야 확인할 수 있어 Task 6의 수동 체크리스트로 둔다.

## Global Constraints

- UI 문구는 한국어, 기존 화면의 Tailwind 클래스 스타일을 그대로 따른다.
- 비밀번호는 8자 이상, bcrypt cost 10 (`bcrypt.hash(password, 10)`).
- 재설정 토큰: 32바이트 랜덤(hex), DB에는 SHA-256 해시만 저장, 유효 시간 1시간, 1회용.
- 같은 사용자의 재설정 메일 재요청은 직전 토큰 생성 후 60초 이내이면 메일을 보내지 않는다.
- `forgot-password`는 계정 존재 여부와 관계없이 같은 성공 응답을 준다.
- 구글 `email_verified`가 true일 때만 로그인을 허용하고, 같은 이메일 계정이 있으면 자동 연결한다. 구글 전용 계정(비밀번호 없음)은 비밀번호 로그인을 할 수 없다.
- `ADMIN_EMAIL`과 일치하는 이메일은 `admin` 권한 (가입 라우트와 동일 규칙).
- 새 환경변수: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`. 실제 키 값은 사용자가 발급해 `.env.local`에 직접 넣는다. 키를 만들거나 대신 입력하지 않는다.
- 작업 트리에 이 기능과 무관한 미커밋 변경(`src/app/globals.css`, `src/app/page.tsx`, `src/lib/technique-service.ts`, `src/components/home/TechniqueCounter.tsx`, `.claude/`)이 있다. 커밋은 항상 이 계획이 건드린 파일만 `git add <경로>`로 지정한다 (`git add -A`, `git add .` 금지).
- 커밋 메시지는 영어 명령형 한 줄 + 아래 트레일러.
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
- 테스트 데이터는 `.env.local`의 `MONGODB_URI`가 가리키는 DB에 쓰이게 된다. Task 6 검증 전에 개발용 DB인지 사용자에게 확인하고, 만든 테스트 계정은 검증 후 삭제한다.

---

## Task 1: User 모델을 구글 계정에 맞게 변경

**Files:**
- Modify: `src/models/User.ts`
- Modify: `src/lib/auth.ts` (authorize 가드)

**Interfaces:**
- Produces: `IUser.password?: string`, `IUser.googleId?: string` (Task 2에서 사용)

- [ ] **Step 1: 인터페이스 수정**

`src/models/User.ts`의 `IUser`에서 다음 두 줄을 바꾼다.

```typescript
  email: string;
  password?: string;
  googleId?: string;
  nickname: string;
```

(기존 `password: string;` 줄을 `password?: string;`으로 바꾸고 바로 아래에 `googleId?: string;`을 추가한다.)

- [ ] **Step 2: 스키마 수정**

기존:

```typescript
    password: { type: String, required: true, select: false },
```

변경:

```typescript
    password: { type: String, select: false },
    googleId: { type: String, unique: true, sparse: true },
```

- [ ] **Step 3: `authorize`에서 비밀번호 없는 계정 거부**

`src/lib/auth.ts`에서 기존:

```typescript
        if (!user) {
          return null;
        }
```

변경:

```typescript
        if (!user || !user.password) {
          return null;
        }
```

- [ ] **Step 4: 타입 검사**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 5: Commit**

```bash
git add src/models/User.ts src/lib/auth.ts
git commit -m "Make user password optional and add googleId field"
```

---

## Task 2: 구글 로그인 (Provider, 사용자 조회/생성, UI)

**Files:**
- Create: `src/lib/google-user.ts`
- Create: `src/components/auth/GoogleButton.tsx`
- Create: `src/app/auth/post-login/page.tsx`
- Modify: `src/lib/auth.ts`
- Modify: `src/app/auth/signin/page.tsx`
- Modify: `src/app/auth/signup/page.tsx`

**Interfaces:**
- Consumes: Task 1의 `IUser.googleId`, 선택적 `password`
- Produces:
  - `findOrCreateGoogleUser(input: { email: string; name?: string | null; googleId: string }): Promise<{ ok: true; user: { id: string; email: string; nickname: string; role: 'user' | 'admin' } } | { ok: false }>`
  - `<GoogleButton label: string />` (클라이언트 컴포넌트, 클릭 시 `signIn('google', { callbackUrl: '/auth/post-login' })`)

- [ ] **Step 1: `src/lib/google-user.ts` 작성**

```typescript
import dbConnect from '@/lib/db';
import User from '@/models/User';

export interface GoogleUserInput {
  email: string;
  name?: string | null;
  googleId: string;
}

export interface AuthUser {
  id: string;
  email: string;
  nickname: string;
  role: 'user' | 'admin';
}

export type GoogleUserResult = { ok: true; user: AuthUser } | { ok: false };

async function generateNickname(
  name: string | null | undefined,
  email: string
): Promise<string> {
  const base = (name ?? '').replace(/\s+/g, '') || email.split('@')[0];
  const root = base.slice(0, 16);

  for (let i = 0; i < 10; i++) {
    const candidate =
      i === 0 ? root : `${root}${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await User.exists({ nickname: candidate }))) {
      return candidate;
    }
  }
  return `${root}${Date.now()}`;
}

function toAuthUser(user: {
  _id: { toString(): string };
  email: string;
  nickname: string;
  role: 'user' | 'admin';
}): AuthUser {
  return {
    id: user._id.toString(),
    email: user.email,
    nickname: user.nickname,
    role: user.role,
  };
}

export async function findOrCreateGoogleUser({
  email,
  name,
  googleId,
}: GoogleUserInput): Promise<GoogleUserResult> {
  await dbConnect();

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });

  if (existing) {
    if (existing.googleId && existing.googleId !== googleId) {
      return { ok: false };
    }
    if (!existing.googleId) {
      await User.updateOne({ _id: existing._id }, { $set: { googleId } });
    }
    return { ok: true, user: toAuthUser(existing) };
  }

  const role =
    process.env.ADMIN_EMAIL &&
    normalizedEmail === process.env.ADMIN_EMAIL.toLowerCase().trim()
      ? 'admin'
      : 'user';

  try {
    const created = await User.create({
      email: normalizedEmail,
      googleId,
      nickname: await generateNickname(name, normalizedEmail),
      role,
    });
    return { ok: true, user: toAuthUser(created) };
  } catch (error: unknown) {
    // 동시 로그인으로 같은 이메일이 먼저 만들어진 경우
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    ) {
      const raced = await User.findOne({ email: normalizedEmail });
      if (raced) {
        return { ok: true, user: toAuthUser(raced) };
      }
    }
    throw error;
  }
}
```

- [ ] **Step 2: `src/lib/auth.ts`에 Provider와 콜백 추가**

import 추가 (기존 `CredentialsProvider` import 아래):

```typescript
import GoogleProvider, { GoogleProfile } from 'next-auth/providers/google';
import { findOrCreateGoogleUser } from '@/lib/google-user';
```

`providers` 배열에서 `CredentialsProvider({...}),` 뒤에 추가:

```typescript
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
```

`callbacks`를 아래로 교체한다 (기존 `jwt`, `session` 전체를 대체).

```typescript
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== 'google') {
        return true;
      }
      const google = profile as GoogleProfile | undefined;
      if (!google?.email || !google.email_verified) {
        return false;
      }
      const result = await findOrCreateGoogleUser({
        email: google.email,
        name: google.name,
        googleId: google.sub,
      });
      return result.ok;
    },
    async jwt({ token, user, account, trigger, session }) {
      if (account?.provider === 'google' && token.email) {
        await dbConnect();
        const dbUser = await User.findOne({
          email: token.email.toLowerCase(),
        }).select('role nickname');
        if (dbUser) {
          token.id = dbUser._id.toString();
          token.role = dbUser.role;
          token.name = dbUser.nickname;
        }
      } else if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      if (trigger === 'update' && session?.name) {
        token.name = session.name;
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
```

- [ ] **Step 3: `src/components/auth/GoogleButton.tsx` 작성**

```tsx
'use client';

import { signIn } from 'next-auth/react';

export default function GoogleButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => signIn('google', { callbackUrl: '/auth/post-login' })}
      className="inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 4: `src/app/auth/post-login/page.tsx` 작성 (역할별 이동)**

```tsx
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';

export default async function PostLogin() {
  const session = await getServerSession(authOptions);
  redirect(session?.user?.role === 'admin' ? '/admin' : '/');
}
```

- [ ] **Step 5: 로그인 화면에 버튼 추가**

`src/app/auth/signin/page.tsx` 상단 import에 추가:

```tsx
import GoogleButton from '@/components/auth/GoogleButton';
```

`</form>`과 `<p className="text-center text-sm text-muted-foreground">` 사이에 삽입:

```tsx
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          또는
          <div className="h-px flex-1 bg-border" />
        </div>
        <GoogleButton label="Google로 계속하기" />
```

- [ ] **Step 6: 회원가입 화면에 같은 버튼 추가**

`src/app/auth/signup/page.tsx`에 같은 import를 추가하고, `</form>`과 `<p className="text-center text-sm text-muted-foreground">` 사이에 Step 5와 동일한 블록을 삽입한다 (버튼 라벨은 `Google로 계속하기` 그대로).

- [ ] **Step 7: 타입 검사와 Provider 노출 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음

Run (개발 서버 `npm run dev` 실행 중에): `curl -s http://localhost:3000/api/auth/providers`
Expected: JSON에 `google`과 `credentials` 키가 모두 있다.

- [ ] **Step 8: Commit**

```bash
git add src/lib/google-user.ts src/lib/auth.ts src/components/auth/GoogleButton.tsx src/app/auth/post-login/page.tsx src/app/auth/signin/page.tsx src/app/auth/signup/page.tsx
git commit -m "Add Google sign-in with automatic account linking"
```

---

## Task 3: 재설정 토큰 모델, 메일 발송, forgot-password API

**Files:**
- Modify: `package.json`, `package-lock.json` (`npm install resend`)
- Create: `src/models/PasswordResetToken.ts`
- Create: `src/lib/password-reset.ts`
- Create: `src/lib/mail.ts`
- Create: `src/app/api/auth/forgot-password/route.ts`

**Interfaces:**
- Produces:
  - `PasswordResetToken` 모델 (`user: ObjectId`, `tokenHash: string`, `expiresAt: Date`, `createdAt: Date`)
  - `generateToken(): string`, `hashToken(token: string): string`, `RESET_TOKEN_TTL_MS = 3600000`, `RESEND_COOLDOWN_MS = 60000`
  - `sendPasswordResetEmail(to: string, resetUrl: string): Promise<void>`
  - `POST /api/auth/forgot-password` body `{ email: string }` → `{ success: true, message: string }`

- [ ] **Step 1: 패키지 설치**

Run: `npm install resend`
Expected: `package.json`의 dependencies에 `resend`가 추가된다.

- [ ] **Step 2: `src/models/PasswordResetToken.ts` 작성**

```typescript
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPasswordResetToken extends Document {
  user: mongoose.Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

const PasswordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// expiresAt 시각이 지나면 MongoDB가 문서를 자동 삭제한다 (삭제는 최대 약 1분 지연될 수 있음)
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PasswordResetToken: Model<IPasswordResetToken> =
  mongoose.models.PasswordResetToken ||
  mongoose.model<IPasswordResetToken>('PasswordResetToken', PasswordResetTokenSchema);

export default PasswordResetToken;
```

- [ ] **Step 3: `src/lib/password-reset.ts` 작성**

```typescript
import crypto from 'crypto';

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
```

- [ ] **Step 4: `src/lib/mail.ts` 작성**

`RESEND_API_KEY`가 없으면 개발 환경에서만 링크를 콘솔에 출력한다 (로컬 검증용). 운영에서는 에러를 던진다.

```typescript
import { Resend } from 'resend';

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[mail:dev] 비밀번호 재설정 링크 (${to}): ${resetUrl}`);
      return;
    }
    throw new Error('RESEND_API_KEY is not set');
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: process.env.MAIL_FROM ?? 'onboarding@resend.dev',
    to,
    subject: '[오쓰그라운드] 비밀번호 재설정 안내',
    html: `
      <div style="font-family: sans-serif; line-height: 1.6;">
        <p>비밀번호 재설정을 요청하셨습니다. 아래 버튼을 눌러 새 비밀번호를 설정해 주세요.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#111;color:#fff;border-radius:6px;text-decoration:none;">
            비밀번호 재설정
          </a>
        </p>
        <p>이 링크는 1시간 동안만 유효합니다. 본인이 요청하지 않았다면 이 메일을 무시해 주세요.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }
}
```

- [ ] **Step 5: `src/app/api/auth/forgot-password/route.ts` 작성**

```typescript
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import PasswordResetToken from '@/models/PasswordResetToken';
import {
  generateToken,
  hashToken,
  RESET_TOKEN_TTL_MS,
  RESEND_COOLDOWN_MS,
} from '@/lib/password-reset';
import { sendPasswordResetEmail } from '@/lib/mail';

const GENERIC_RESPONSE = {
  success: true,
  message: '입력하신 이메일로 가입된 계정이 있다면 재설정 메일을 보냈습니다.',
};

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (typeof email !== 'string' || !email.trim()) {
      return NextResponse.json(
        { success: false, error: '이메일을 입력해 주세요.' },
        { status: 400 }
      );
    }

    await dbConnect();

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      '_id email'
    );

    if (user) {
      const recent = await PasswordResetToken.findOne({
        user: user._id,
        createdAt: { $gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
      });

      if (!recent) {
        await PasswordResetToken.deleteMany({ user: user._id });

        const token = generateToken();
        await PasswordResetToken.create({
          user: user._id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        });

        const baseUrl = (process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '');
        try {
          await sendPasswordResetEmail(
            user.email,
            `${baseUrl}/auth/reset-password?token=${token}`
          );
        } catch (mailError) {
          console.error('Password reset mail error:', mailError);
        }
      }
    }

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: false, error: '요청을 처리하지 못했습니다.' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 6: 타입 검사**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/models/PasswordResetToken.ts src/lib/password-reset.ts src/lib/mail.ts src/app/api/auth/forgot-password/route.ts
git commit -m "Add password reset token model, mail helper and forgot-password API"
```

---

## Task 4: reset-password API

**Files:**
- Create: `src/app/api/auth/reset-password/route.ts`

**Interfaces:**
- Consumes: `hashToken`, `PasswordResetToken` (Task 3)
- Produces: `POST /api/auth/reset-password` body `{ token: string; password: string }` → 성공 `{ success: true }`, 실패 `{ success: false, error: string }` (400)

- [ ] **Step 1: 라우트 작성**

토큰은 `findOneAndDelete`로 조회와 소비를 한 번에 처리해 동시 재사용을 막는다.

```typescript
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import PasswordResetToken from '@/models/PasswordResetToken';
import { hashToken } from '@/lib/password-reset';

const INVALID_LINK = {
  success: false,
  error: '유효하지 않거나 만료된 링크입니다. 재설정을 다시 요청해 주세요.',
};

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();

    if (typeof token !== 'string' || !token) {
      return NextResponse.json(INVALID_LINK, { status: 400 });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { success: false, error: '비밀번호는 최소 8자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    await dbConnect();

    const record = await PasswordResetToken.findOneAndDelete({
      tokenHash: hashToken(token),
    });

    if (!record || record.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json(INVALID_LINK, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.updateOne({ _id: record.user }, { $set: { password: hashedPassword } });
    await PasswordResetToken.deleteMany({ user: record.user });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, error: '비밀번호를 재설정하지 못했습니다.' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 타입 검사**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/reset-password/route.ts
git commit -m "Add reset-password API with single-use tokens"
```

---

## Task 5: 재설정 화면 두 개와 로그인 화면 링크

**Files:**
- Create: `src/app/auth/forgot-password/page.tsx`
- Create: `src/components/auth/ResetPasswordForm.tsx`
- Create: `src/app/auth/reset-password/page.tsx`
- Modify: `src/app/auth/signin/page.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` (응답 형식은 Task 3, 4 참고)
- Produces: `<ResetPasswordForm token: string />`

- [ ] **Step 1: `src/app/auth/forgot-password/page.tsx` 작성**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';

const inputClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const buttonClass =
  'inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || '요청을 처리하지 못했습니다.');
        return;
      }

      setSent(true);
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
          <h1 className="text-2xl font-bold">비밀번호 재설정</h1>
          <p className="text-gray-500 dark:text-gray-400">
            가입한 이메일로 재설정 링크를 보내드립니다
          </p>
        </div>
        {sent ? (
          <p className="text-sm text-center">
            입력하신 이메일로 가입된 계정이 있다면 재설정 메일을 보냈습니다.
            메일함을 확인해 주세요. 링크는 1시간 동안 유효합니다.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email">이메일</label>
              <input
                id="email"
                type="email"
                required
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={loading} className={buttonClass}>
              {loading ? '보내는 중...' : '재설정 메일 보내기'}
            </button>
          </form>
        )}
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/auth/signin" className="underline hover:text-foreground">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `src/components/auth/ResetPasswordForm.tsx` 작성**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const inputClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const buttonClass =
  'inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || '비밀번호를 재설정하지 못했습니다.');
        return;
      }

      router.push('/auth/signin');
    } catch {
      setError('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <p className="text-sm text-center">
        유효하지 않은 링크입니다.{' '}
        <Link href="/auth/forgot-password" className="underline hover:text-foreground">
          재설정을 다시 요청
        </Link>
        해 주세요.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="password">새 비밀번호</label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="confirm">새 비밀번호 확인</label>
        <input
          id="confirm"
          type="password"
          required
          minLength={8}
          className={inputClass}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button type="submit" disabled={loading} className={buttonClass}>
        {loading ? '변경 중...' : '비밀번호 변경'}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: `src/app/auth/reset-password/page.tsx` 작성**

Next 16에서 `searchParams`는 Promise다.

```tsx
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

export default async function ResetPassword({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <div className="mx-auto w-full max-w-sm space-y-6 p-6 border rounded-lg shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">새 비밀번호 설정</h1>
          <p className="text-gray-500 dark:text-gray-400">
            8자 이상의 새 비밀번호를 입력해 주세요
          </p>
        </div>
        <ResetPasswordForm token={token ?? ''} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 로그인 화면에 링크 추가**

`src/app/auth/signin/page.tsx`에서 아래 줄 바로 위에 삽입한다.

```tsx
          {error && <p className="text-sm text-red-500">{error}</p>}
```

삽입할 내용:

```tsx
          <div className="text-right">
            <Link
              href="/auth/forgot-password"
              className="text-sm text-muted-foreground underline hover:text-foreground"
            >
              비밀번호를 잊으셨나요?
            </Link>
          </div>
```

- [ ] **Step 5: 타입 검사와 화면 응답 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음

Run (개발 서버 실행 중에):
`for p in /auth/signin /auth/forgot-password '/auth/reset-password?token=x'; do curl -s -o /dev/null -w "$p %{http_code}\n" "http://localhost:3000$p"; done`
Expected: 세 경로 모두 `200`

- [ ] **Step 6: Commit**

```bash
git add src/app/auth/forgot-password/page.tsx src/components/auth/ResetPasswordForm.tsx src/app/auth/reset-password/page.tsx src/app/auth/signin/page.tsx
git commit -m "Add forgot-password and reset-password screens"
```

---

## Task 6: 환경변수, 전체 검증

**Files:**
- Modify: `.env.local` (사용자가 직접 값 입력, 커밋 대상 아님)

- [ ] **Step 1: 환경변수 키 안내 (값은 사용자가 입력)**

사용자에게 `.env.local`에 아래 키를 추가해 달라고 안내한다. 값 없이도 재설정 흐름은 개발 모드에서 콘솔 로그로 검증할 수 있다.

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=
MAIL_FROM=
```

구글 키 발급 시 승인된 리디렉션 URI는 `{NEXTAUTH_URL}/api/auth/callback/google`이다.

- [ ] **Step 2: DB 확인**

`.env.local`의 `MONGODB_URI`가 개발용 DB인지 사용자에게 확인한다. 운영 DB라면 Step 3 이후의 테스트 계정 생성은 중단하고 사용자에게 알린다.

- [ ] **Step 3: 개발 서버 실행과 테스트 계정 생성**

```bash
npm run dev > /tmp/ossground-dev.log 2>&1 &
sleep 8
curl -s -X POST http://localhost:3000/api/auth/signup -H 'Content-Type: application/json' \
  -d '{"email":"reset-test@example.com","password":"oldpassword1","nickname":"reset-test"}'
```

Expected: `"success":true`

- [ ] **Step 4: forgot-password 응답 동일성과 재요청 제한**

```bash
curl -s -X POST http://localhost:3000/api/auth/forgot-password -H 'Content-Type: application/json' -d '{"email":"reset-test@example.com"}'
curl -s -X POST http://localhost:3000/api/auth/forgot-password -H 'Content-Type: application/json' -d '{"email":"nobody@example.com"}'
curl -s -X POST http://localhost:3000/api/auth/forgot-password -H 'Content-Type: application/json' -d '{"email":"reset-test@example.com"}'
grep -c 'mail:dev' /tmp/ossground-dev.log
```

Expected: 세 응답 본문이 동일하고, 로그의 `[mail:dev]` 줄은 정확히 1개 (존재하지 않는 이메일과 60초 이내 재요청은 메일이 없다).

- [ ] **Step 5: 재설정 성공, 재사용 거부, 검증 오류**

로그에서 `token=` 뒤 값을 TOKEN으로 취한다.

```bash
curl -s -X POST http://localhost:3000/api/auth/reset-password -H 'Content-Type: application/json' -d '{"token":"x","password":"short"}'
curl -s -X POST http://localhost:3000/api/auth/reset-password -H 'Content-Type: application/json' -d "{\"token\":\"$TOKEN\",\"password\":\"newpassword1\"}"
curl -s -X POST http://localhost:3000/api/auth/reset-password -H 'Content-Type: application/json' -d "{\"token\":\"$TOKEN\",\"password\":\"newpassword2\"}"
```

Expected: 첫 번째는 400(8자 미만), 두 번째는 `{"success":true}`, 세 번째는 400(유효하지 않거나 만료된 링크).

- [ ] **Step 6: 새 비밀번호로 로그인**

```bash
CSRF=$(curl -s -c /tmp/jar http://localhost:3000/api/auth/csrf | python3 -c 'import sys,json;print(json.load(sys.stdin)["csrfToken"])')
curl -s -b /tmp/jar -c /tmp/jar -X POST http://localhost:3000/api/auth/callback/credentials -d "csrfToken=$CSRF&email=reset-test@example.com&password=newpassword1" -o /dev/null -w '%{http_code}\n'
curl -s -b /tmp/jar http://localhost:3000/api/auth/session
```

Expected: 세션 JSON에 `reset-test@example.com`이 보인다. 이전 비밀번호(`oldpassword1`)로 같은 절차를 하면 세션이 비어 있다.
- [ ] **Step 7: 만료 토큰 거부**

새 토큰을 발급받은 뒤(쿨다운 60초 경과 후) 만료 시각을 과거로 바꾸고 재설정을 시도한다.

```bash
node --env-file=.env.local -e "
const m=require('mongoose');
m.connect(process.env.MONGODB_URI).then(async()=>{
  await m.connection.collection('passwordresettokens').updateMany({}, {\$set:{expiresAt:new Date(Date.now()-1000)}});
  await m.disconnect();
});"
```

Expected: 해당 토큰으로 `reset-password` 호출 시 400 (유효하지 않거나 만료된 링크).

- [ ] **Step 8: 테스트 데이터 정리**

```bash
node --env-file=.env.local -e "
const m=require('mongoose');
m.connect(process.env.MONGODB_URI).then(async()=>{
  await m.connection.collection('users').deleteOne({email:'reset-test@example.com'});
  await m.connection.collection('passwordresettokens').deleteMany({});
  await m.disconnect();
});"
```

주의: `passwordresettokens`는 이 기능이 새로 만든 컬렉션이라 전체 삭제해도 안전하다. 개발 서버도 종료한다.

- [ ] **Step 9: 구글 로그인 수동 체크리스트 (키 입력 후 사용자와 함께)**

1. 새 구글 계정으로 `/auth/signin`에서 "Google로 계속하기" → 가입되고 `/`로 이동, 내 정보에 자동 생성된 닉네임이 보인다.
2. 이메일로 먼저 가입한 계정과 같은 이메일의 구글 계정으로 로그인 → 새 계정이 생기지 않고 기존 계정에 연결된다 (닉네임 동일, 비밀번호 로그인도 계속 가능).
3. `ADMIN_EMAIL`과 같은 구글 이메일로 로그인 → `/admin`으로 이동한다.
4. 구글 전용 계정에서 비밀번호 재설정 후 이메일/비밀번호로도 로그인된다.

- [ ] **Step 10: lint와 build**

Run: `npm run lint`
Expected: 이 계획이 추가·수정한 파일에서 새 에러 없음 (기존 파일의 사전 경고는 무시)

Run: `npm run build`
Expected: 빌드 성공, `/auth/forgot-password`, `/auth/reset-password`, `/auth/post-login`, `/api/auth/forgot-password`, `/api/auth/reset-password` 라우트가 출력에 보인다.

---

## Self-Review 결과

- **스펙 커버리지:** 구글 Provider/계정 연결/닉네임 생성/admin 규칙(Task 2), 모델 변경과 구글 전용 계정 비밀번호 로그인 차단(Task 1), 토큰 모델·TTL(Task 3), forgot-password의 동일 응답·60초 제한(Task 3), reset-password의 1회용·만료·8자 검증(Task 4), 화면과 로그인 링크(Task 5), 환경변수·검증·lint/build(Task 6). 빠진 항목 없음.
- **스펙 대비 추가:** `/auth/post-login`(구글 로그인 후 관리자 `/admin` 이동용), 개발 환경에서 `RESEND_API_KEY`가 없을 때 링크를 콘솔에 출력하는 폴백(로컬 검증용), 토큰 소비를 `findOneAndDelete`로 처리(동시 재사용 방지).
- **타입 일관성:** `findOrCreateGoogleUser` 시그니처, `hashToken`/`generateToken`, `sendPasswordResetEmail(to, resetUrl)`, `ResetPasswordForm({ token })`가 정의된 태스크와 사용 태스크에서 일치한다.
