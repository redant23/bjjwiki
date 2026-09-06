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
