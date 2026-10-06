import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';
import { requireAdmin } from '@/lib/auth';
import { renumberSiblings } from '@/lib/technique-order';

export async function PUT(request: Request) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    await dbConnect();
    const body = await request.json();
    const { items } = body; // Array of { _id: string, order: number }

    if (
      !Array.isArray(items) ||
      !items.every(
        (item) =>
          item &&
          mongoose.isValidObjectId(item._id) &&
          typeof item.order === 'number' &&
          Number.isFinite(item.order)
      )
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid data format' },
        { status: 400 }
      );
    }

    if (items.length === 0) {
      return NextResponse.json({ success: true, renumbered: 0 });
    }

    // 1. 요청받은 순서를 그대로 반영
    await Technique.bulkWrite(
      items.map((item) => ({
        updateOne: {
          filter: { _id: item._id },
          update: { $set: { order: item.order } },
        },
      }))
    );

    // 2. 영향받은 부모들의 형제를 고유 번호로 재번호한다. 화면에 안 보이는 임시저장 기술이나
    //    이번에 건드리지 않은 형제와 order가 겹쳐 있어도 순서가 흔들리지 않게 한다.
    const explicitIds = new Set<string>(items.map((item) => String(item._id)));
    const touched = await Technique.find({ _id: { $in: [...explicitIds] } })
      .select('parentId')
      .lean();
    const parentKeys = new Set<string | null>(touched.map((t) => (t.parentId ? t.parentId.toString() : null)));

    const renumberOps: Array<{
      updateOne: { filter: { _id: string }; update: { $set: { order: number } } };
    }> = [];
    for (const parentKey of parentKeys) {
      const siblings = await Technique.find({ parentId: parentKey })
        .select('_id name.ko order')
        .lean();
      const changes = renumberSiblings(
        siblings.map((s) => {
          const id = s._id.toString();
          return {
            _id: id,
            parentId: parentKey,
            order: s.order ?? 0,
            name: s.name?.ko ?? '',
            priority: explicitIds.has(id) ? 0 : 1,
          };
        })
      );
      for (const [id, order] of changes) {
        renumberOps.push({ updateOne: { filter: { _id: id }, update: { $set: { order } } } });
      }
    }
    if (renumberOps.length > 0) {
      await Technique.bulkWrite(renumberOps, { timestamps: false });
    }

    revalidateTag('technique-tree', 'max');

    return NextResponse.json({ success: true, renumbered: renumberOps.length });
  } catch (error) {
    console.error('Reorder failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reorder techniques' },
      { status: 500 }
    );
  }
}
