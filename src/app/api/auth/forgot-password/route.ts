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
