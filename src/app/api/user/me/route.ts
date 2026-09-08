import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import User, { IUser, MAX_STRIPES_BY_LEVEL } from '@/models/User';

const VALID_LEVELS: IUser['level'][] = ['white', 'blue', 'purple', 'brown', 'black'];

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
