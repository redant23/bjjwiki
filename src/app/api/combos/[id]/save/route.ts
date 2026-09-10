import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/db';
import { authOptions } from '@/lib/auth';
import Combo from '@/models/Combo';
import User from '@/models/User';

export async function POST(
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

    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const alreadySaved = user.savedCombos.some((id) => id.toString() === params.id);

    if (alreadySaved) {
      user.savedCombos = user.savedCombos.filter((id) => id.toString() !== params.id);
      combo.saveCount = Math.max(0, combo.saveCount - 1);
    } else {
      user.savedCombos.push(combo._id);
      combo.saveCount += 1;
    }

    await user.save();
    await combo.save();

    return NextResponse.json({
      success: true,
      data: { saved: !alreadySaved, saveCount: combo.saveCount },
    });
  } catch (error) {
    console.error('POST /api/combos/[id]/save error:', error);
    return NextResponse.json({ success: false, error: 'Failed to toggle save' }, { status: 500 });
  }
}
