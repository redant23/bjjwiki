import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';

export async function GET() {
  try {
    await dbConnect();

    // 1. Clear all childrenIds first to ensure clean state
    await Technique.updateMany({}, { $set: { childrenIds: [] } });

    // 2. Find all techniques that have a parent
    const children = await Technique.find({ parentId: { $ne: null } }).select('_id parentId');

    let updatedCount = 0;

    // 3. Add each child to its parent's childrenIds
    for (const child of children) {
      if (child.parentId) {
        await Technique.findByIdAndUpdate(child.parentId, {
          $addToSet: { childrenIds: child._id }
        });
        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced childrenIds for ${updatedCount} techniques.`
    });
  } catch (error) {
    console.error('Sync failed:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
