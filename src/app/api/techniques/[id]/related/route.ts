import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';
import Combo from '@/models/Combo';
import { followingInChains } from '@/lib/combo-chain';

const MAX_COMBOS = 6;
// 이어지는 기술 계산에 쓸 콤보 수 상한 (이 기술이 들어간 콤보 중 저장 많은 순)
const MAX_CHAIN_COMBOS = 200;

// 상세 페이지 하단용: 콤보 체인에서 이어지는 기술, 이전/다음 형제, 이 기술이 포함된 콤보.
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
      Combo.find({ techniques: technique._id })
        .sort({ saveCount: -1, createdAt: -1 })
        .limit(MAX_CHAIN_COMBOS)
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

    // 이 기술 바로 다음에 이어진 기술: 콤보에 등록된 순서를 기준으로 센다 (게시된 기술만 표시)
    const following = followingInChains(
      comboDocs.map((c) => c.techniques.map((t: mongoose.Types.ObjectId) => t.toString())),
      params.id
    );
    const followingDocs = following.length
      ? await Technique.find({ _id: { $in: following.map((f) => f._id) }, status: 'published' })
          .select('name slug pathSlugs')
          .lean()
      : [];
    const followingById = new Map(followingDocs.map((t) => [t._id.toString(), t]));

    const siblings = siblingDocs.map(toItem);
    const index = siblings.findIndex((s) => s._id === params.id);

    return NextResponse.json({
      success: true,
      data: {
        prev: index > 0 ? siblings[index - 1] : null,
        next: index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null,
        following: following.flatMap((f) => {
          const t = followingById.get(f._id);
          return t
            ? [
                {
                  _id: f._id,
                  name: t.name.ko as string,
                  href: `/technique/${[...(t.pathSlugs || []), t.slug].join('/')}`,
                  count: f.count,
                },
              ]
            : [];
        }),
        combos: comboDocs.slice(0, MAX_COMBOS).map((c) => ({
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
