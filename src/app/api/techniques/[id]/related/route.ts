import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';
import Combo from '@/models/Combo';

const MAX_SIBLINGS = 12;
const MAX_COMBOS = 6;

// 상세 페이지 하단용: 같은 계열(형제) 기술, 이전/다음 형제, 이 기술이 포함된 콤보.
export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
    }

    await dbConnect();
    const technique = await Technique.findById(params.id).select('parentId').lean();
    if (!technique) {
      return NextResponse.json({ success: false, error: 'Technique not found' }, { status: 404 });
    }

    const [siblingDocs, comboDocs] = await Promise.all([
      Technique.find({ parentId: technique.parentId ?? null, status: 'published' })
        .sort({ order: 1, 'name.ko': 1 })
        .select('name slug pathSlugs primaryRole thumbnailUrl')
        .lean(),
      Combo.find({ techniques: technique._id })
        .sort({ saveCount: -1, createdAt: -1 })
        .limit(MAX_COMBOS)
        .select('name techniques saveCount')
        .lean(),
    ]);

    const toItem = (t: (typeof siblingDocs)[number]) => ({
      _id: t._id.toString(),
      name: t.name.ko as string,
      href: `/technique/${[...(t.pathSlugs || []), t.slug].join('/')}`,
      primaryRole: t.primaryRole as string,
      thumbnailUrl: (t.thumbnailUrl as string | undefined) || null,
    });

    const siblings = siblingDocs.map(toItem);
    const index = siblings.findIndex((s) => s._id === params.id);

    return NextResponse.json({
      success: true,
      data: {
        // 형제 중 자기 자신은 제외 (순서는 사이드바와 같은 order 기준)
        siblings: siblings.filter((s) => s._id !== params.id).slice(0, MAX_SIBLINGS),
        prev: index > 0 ? siblings[index - 1] : null,
        next: index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null,
        combos: comboDocs.map((c) => ({
          _id: c._id.toString(),
          name: c.name as string,
          length: c.techniques.length,
          saveCount: c.saveCount ?? 0,
        })),
      },
    });
  } catch (error) {
    console.error('GET related error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load related' }, { status: 500 });
  }
}
