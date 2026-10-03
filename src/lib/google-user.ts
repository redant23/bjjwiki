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

  const MAX_ATTEMPTS = 3;
  let nickname = await generateNickname(name, normalizedEmail);

  for (let attempt = 1; ; attempt++) {
    try {
      const created = await User.create({
        email: normalizedEmail,
        googleId,
        nickname,
        role,
      });
      return { ok: true, user: toAuthUser(created) };
    } catch (error: unknown) {
      const dup = error as {
        code?: number;
        keyPattern?: Record<string, unknown>;
      } | null;
      if (typeof error !== 'object' || dup?.code !== 11000) {
        throw error;
      }
      // 동시 로그인으로 같은 이메일이 먼저 만들어진 경우
      const raced = await User.findOne({ email: normalizedEmail });
      if (raced) {
        return { ok: true, user: toAuthUser(raced) };
      }
      // 닉네임 중복(동시 가입)이면 새 닉네임으로 재시도
      if (!dup.keyPattern?.nickname || attempt >= MAX_ATTEMPTS) {
        throw error;
      }
      nickname = await generateNickname(name, normalizedEmail);
    }
  }
}
