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
