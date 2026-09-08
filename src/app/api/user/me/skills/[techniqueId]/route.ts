import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import User from '@/models/User';

const VALID_STATUSES = ['interested', 'practicing', 'frequently_used', 'signature'];

export async function GET(
  request: Request,
  props: { params: Promise<{ techniqueId: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!mongoose.isValidObjectId(params.techniqueId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid technique id' },
        { status: 400 }
      );
    }

    await dbConnect();

    const user = await User.findById(session.user.id).select('mySkills');

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const entry = user.mySkills.find(
      (s) => s.technique.toString() === params.techniqueId
    );

    return NextResponse.json({
      success: true,
      data: {
        status: entry?.status ?? null,
        isFavorite: entry?.isFavorite ?? false,
      },
    });
  } catch (error) {
    console.error('GET /api/user/me/skills/[techniqueId] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch skill' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ techniqueId: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!mongoose.isValidObjectId(params.techniqueId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid technique id' },
        { status: 400 }
      );
    }

    const body = await request.json();

    if (
      body.status !== undefined &&
      body.status !== null &&
      !VALID_STATUSES.includes(body.status)
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid status value' },
        { status: 400 }
      );
    }

    await dbConnect();

    const user = await User.findById(session.user.id);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const existingIndex = user.mySkills.findIndex(
      (s) => s.technique.toString() === params.techniqueId
    );
    const existing = existingIndex >= 0 ? user.mySkills[existingIndex] : null;

    const nextStatus =
      body.status !== undefined ? body.status : existing?.status ?? null;
    const nextIsFavorite =
      body.isFavorite !== undefined ? body.isFavorite : existing?.isFavorite ?? false;

    if (nextStatus === 'signature') {
      const signatureCount = user.mySkills.filter(
        (s, i) => i !== existingIndex && s.status === 'signature'
      ).length;
      if (signatureCount >= 2) {
        return NextResponse.json(
          {
            success: false,
            error: '나를 대표하는 기술은 최대 2개까지 지정할 수 있습니다.',
          },
          { status: 400 }
        );
      }
    }

    if (nextStatus === null && !nextIsFavorite) {
      if (existingIndex >= 0) {
        user.mySkills.splice(existingIndex, 1);
      }
    } else if (existingIndex >= 0) {
      user.mySkills[existingIndex].status = nextStatus;
      user.mySkills[existingIndex].isFavorite = nextIsFavorite;
    } else {
      user.mySkills.push({
        technique: new mongoose.Types.ObjectId(params.techniqueId),
        status: nextStatus,
        isFavorite: nextIsFavorite,
      });
    }

    await user.save();

    return NextResponse.json({
      success: true,
      data: { status: nextStatus, isFavorite: nextIsFavorite },
    });
  } catch (error) {
    console.error('PUT /api/user/me/skills/[techniqueId] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update skill' },
      { status: 500 }
    );
  }
}
