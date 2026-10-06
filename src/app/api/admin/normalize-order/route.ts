import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';
import { requireAdmin } from '@/lib/auth';
import { planOrderNormalization } from '@/lib/technique-order';

// 모든 형제 그룹의 order를 고유한 연속 번호로 정리한다 (겹친 값 제거).
// POST /api/admin/normalize-order?dryRun=1            → 바뀔 항목 수와 루트 순서만 보고
// POST /api/admin/normalize-order?rootOrder=flow      → 루트를 경기 흐름순(스탠딩→가드→패스→포지션→서브미션→이스케이프→드릴)으로 배치
export async function POST(request: Request) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const params = new URL(request.url).searchParams;
    const dryRun = params.get('dryRun') === '1';
    const rootFlow = params.get('rootOrder') === 'flow';

    await dbConnect();
    const docs = await Technique.find().select('_id parentId order name.ko').lean();
    const { changes, rootOrder } = planOrderNormalization(
      docs.map((d) => ({
        _id: d._id.toString(),
        parentId: d.parentId ? d.parentId.toString() : null,
        order: d.order ?? 0,
        name: d.name?.ko ?? '',
      })),
      { rootFlow }
    );

    if (!dryRun && changes.size > 0) {
      await Technique.bulkWrite(
        [...changes].map(([id, order]) => ({
          updateOne: { filter: { _id: id }, update: { $set: { order } } },
        })),
        { timestamps: false }
      );
      revalidateTag('technique-tree', 'max');
    }

    return NextResponse.json({
      success: true,
      dryRun,
      data: { total: docs.length, changed: changes.size, rootOrder },
    });
  } catch (error) {
    console.error('normalize-order failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to normalize order' },
      { status: 500 }
    );
  }
}
