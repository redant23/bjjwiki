import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { authOptions } from '@/lib/auth';
import Combo from '@/models/Combo';
import Technique from '@/models/Technique';
import User from '@/models/User';

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort');

    const sortOptions: any = sort === 'recent' ? { createdAt: -1 } : { saveCount: -1 };

    const combos: any[] = await Combo.find()
      .sort(sortOptions)
      .populate('techniques', 'name slug pathSlugs')
      .populate('createdBy', 'nickname')
      .lean();

    const session = await getServerSession(authOptions);
    let savedSet = new Set<string>();
    if (session) {
      const user = await User.findById(session.user.id).select('savedCombos').lean();
      savedSet = new Set((user?.savedCombos || []).map((id: any) => id.toString()));
    }

    const data = combos.map((combo) => ({
      ...combo,
      savedByMe: savedSet.has(combo._id.toString()),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('GET /api/combos error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch combos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const techniqueIds: string[] = Array.isArray(body.techniques) ? body.techniques : [];

    if (
      techniqueIds.length < 2 ||
      !techniqueIds.every((id) => mongoose.Types.ObjectId.isValid(id))
    ) {
      return NextResponse.json(
        { success: false, error: '기술은 2개 이상, 유효한 ID여야 합니다.' },
        { status: 400 }
      );
    }

    await dbConnect();

    const uniqueTechniqueIds = [...new Set(techniqueIds)];
    const existingCount = await Technique.countDocuments({ _id: { $in: uniqueTechniqueIds } });
    if (existingCount !== uniqueTechniqueIds.length) {
      return NextResponse.json(
        { success: false, error: '존재하지 않는 기술이 포함되어 있습니다.' },
        { status: 400 }
      );
    }

    const techniqueObjectIds = techniqueIds.map((id) => new mongoose.Types.ObjectId(id));

    // MongoDB matches an array field against a plain array value only when
    // the elements, order, and length are all identical — exactly the
    // "same chain, same order" duplicate we want to reject.
    const duplicate = await Combo.findOne({ techniques: techniqueObjectIds });
    if (duplicate) {
      return NextResponse.json(
        { success: false, error: '이미 등록된 콤보입니다.' },
        { status: 400 }
      );
    }

    const comboCount = await Combo.countDocuments({ createdBy: session.user.id });
    const nickname = session.user.name || '유저';
    const name = `${nickname} 콤보${comboCount + 1}`;

    const combo = await Combo.create({
      name,
      techniques: techniqueObjectIds,
      videoUrl: body.videoUrl || undefined,
      photoUrl: body.photoUrl || undefined,
      createdBy: session.user.id,
      saveCount: 0,
    });

    return NextResponse.json({ success: true, data: combo });
  } catch (error) {
    console.error('POST /api/combos error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create combo' }, { status: 500 });
  }
}
