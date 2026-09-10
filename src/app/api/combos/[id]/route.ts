import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/db';
import { authOptions } from '@/lib/auth';
import Combo from '@/models/Combo';
import User from '@/models/User';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    await dbConnect();
    const combo: any = await Combo.findById(params.id)
      .populate('techniques', 'name slug pathSlugs')
      .populate('createdBy', 'nickname')
      .lean();

    if (!combo) {
      return NextResponse.json({ success: false, error: 'Combo not found' }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    let savedByMe = false;
    if (session) {
      const user = await User.findById(session.user.id).select('savedCombos').lean();
      savedByMe = (user?.savedCombos || []).some((id: any) => id.toString() === params.id);
    }

    return NextResponse.json({ success: true, data: { ...combo, savedByMe } });
  } catch (error) {
    console.error('GET /api/combos/[id] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch combo' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const combo = await Combo.findById(params.id);
    if (!combo) {
      return NextResponse.json({ success: false, error: 'Combo not found' }, { status: 404 });
    }

    if (combo.createdBy.toString() !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json({ success: false, error: '이름은 비워둘 수 없습니다.' }, { status: 400 });
      }
      combo.name = body.name.trim();
    }
    if (body.videoUrl !== undefined) {
      combo.videoUrl = body.videoUrl || undefined;
    }
    if (body.photoUrl !== undefined) {
      combo.photoUrl = body.photoUrl || undefined;
    }

    await combo.save();

    return NextResponse.json({ success: true, data: combo });
  } catch (error) {
    console.error('PATCH /api/combos/[id] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update combo' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const combo = await Combo.findById(params.id);
    if (!combo) {
      return NextResponse.json({ success: false, error: 'Combo not found' }, { status: 404 });
    }

    if (combo.createdBy.toString() !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    await combo.deleteOne();

    // 삭제된 콤보를 저장해둔 유저들의 savedCombos에 고아 참조가 남지 않도록 정리.
    await User.updateMany(
      { savedCombos: params.id },
      { $pull: { savedCombos: params.id } }
    );

    return NextResponse.json({ success: true, data: {} });
  } catch (error) {
    console.error('DELETE /api/combos/[id] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete combo' }, { status: 500 });
  }
}
