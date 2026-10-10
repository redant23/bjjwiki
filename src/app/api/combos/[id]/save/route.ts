import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Combo from '@/models/Combo';
import User from '@/models/User';
import { canViewCombo, findComboByParam, isComboPublished } from '@/lib/combo-service';
import { getViewer, jsonError, NOT_FOUND, UNAUTHORIZED } from '@/lib/combo-api';

export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  try {
    const viewer = await getViewer();
    if (!viewer) return UNAUTHORIZED();

    await dbConnect();
    const combo = await findComboByParam(id);
    if (!combo || !canViewCombo(combo, viewer)) return NOT_FOUND();
    if (!isComboPublished(combo)) {
      return NextResponse.json(
        { success: false, error: '승인 후 이용할 수 있어요.' },
        { status: 403 }
      );
    }

    const user = await User.findById(viewer.id).select('savedCombos');
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const alreadySaved = user.savedCombos.some((c) => c.toString() === String(combo._id));
    let saveCount = combo.saveCount;

    if (alreadySaved) {
      const pull = await User.updateOne(
        { _id: viewer.id },
        { $pull: { savedCombos: combo._id, savedComboLog: { combo: combo._id } } }
      );
      if (pull.modifiedCount > 0) {
        const decremented = await Combo.findOneAndUpdate(
          { _id: combo._id, saveCount: { $gt: 0 } },
          { $inc: { saveCount: -1 } },
          { new: true }
        );
        saveCount = decremented ? decremented.saveCount : 0;
      }
    } else {
      const add = await User.updateOne(
        { _id: viewer.id, savedCombos: { $ne: combo._id } },
        {
          $addToSet: { savedCombos: combo._id },
          $push: { savedComboLog: { combo: combo._id, savedAt: new Date() } },
        }
      );
      if (add.modifiedCount > 0) {
        const incremented = await Combo.findByIdAndUpdate(
          combo._id,
          { $inc: { saveCount: 1 } },
          { new: true }
        );
        saveCount = incremented ? incremented.saveCount : combo.saveCount + 1;
      }
    }

    return NextResponse.json({ success: true, data: { saved: !alreadySaved, saveCount } });
  } catch (error) {
    return jsonError(error, 'POST /api/combos/[id]/save');
  }
}
