import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';
import Combo from '@/models/Combo';
import { PUBLISHED_FILTER } from '@/lib/combo-service';

const MAX_COMBOS = 6;

// 상세 페이지 하단용: 이전/다음 형제, 이 기술이 포함된 콤보(기술 체인 포함).
// (형제 목록 자체는 화면에 보여주지 않는다 — 연결 기술은 작성자가 직접 고른 목록으로 보여준다.)
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
      Combo.find({ techniques: technique._id, ...PUBLISHED_FILTER })
        .sort({ saveCount: -1, createdAt: -1 })
        .limit(MAX_COMBOS)
        .populate('techniques', 'name slug pathSlugs')
        .select('number techniques saveCount')
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
        prev: index > 0 ? siblings[index - 1] : null,
        next: index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null,
        combos: comboDocs.map((c) => ({
          _id: c._id.toString(),
          number: typeof c.number === 'number' ? c.number : null,
          saveCount: c.saveCount ?? 0,
          // 콤보에 등록된 순서 그대로의 기술 체인 (삭제된 기술은 populate에서 빠진다)
          chain: (c.techniques as unknown as Array<{
            _id: mongoose.Types.ObjectId;
            name: { ko: string };
            slug: string;
            pathSlugs?: string[];
          }>).map((t) => ({
            _id: t._id.toString(),
            name: t.name.ko,
            href: `/technique/${[...(t.pathSlugs || []), t.slug].join('/')}`,
          })),
        })),
      },
    });
  } catch (error) {
    console.error('GET related error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load related' }, { status: 500 });
  }
}
