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

    const user = await User.findById(session.user.id).select('savedCombos');
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const alreadySaved = user.savedCombos.some((id) => id.toString() === params.id);

    let saveCount: number;

    if (alreadySaved) {
      await User.updateOne({ _id: session.user.id }, { $pull: { savedCombos: combo._id } });
      const decremented = await Combo.findOneAndUpdate(
        { _id: params.id, saveCount: { $gt: 0 } },
        { $inc: { saveCount: -1 } },
        { new: true }
      );
      saveCount = decremented ? decremented.saveCount : 0;
    } else {
      await User.updateOne({ _id: session.user.id }, { $addToSet: { savedCombos: combo._id } });
      const incremented = await Combo.findByIdAndUpdate(
        params.id,
        { $inc: { saveCount: 1 } },
        { new: true }
      );
      saveCount = incremented ? incremented.saveCount : combo.saveCount + 1;
    }

    return NextResponse.json({
      success: true,
      data: { saved: !alreadySaved, saveCount },
    });
  } catch (error) {
    console.error('POST /api/combos/[id]/save error:', error);
    return NextResponse.json({ success: false, error: 'Failed to toggle save' }, { status: 500 });
  }
}
