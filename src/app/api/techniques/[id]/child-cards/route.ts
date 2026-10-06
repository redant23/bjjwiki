import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';
import { summarizeMarkdown } from '@/lib/technique-cards';

// 카테고리(상위 기술) 페이지의 자식 카드 데이터: 썸네일, 설명 요약, 하위 기술 수, 영상 유무,
// 그리고 썸네일이 없을 때 쓸 루트 분류 이름.
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
    const parent = await Technique.findById(params.id).select('name pathSlugs level').lean();
    if (!parent) {
      return NextResponse.json({ success: false, error: 'Technique not found' }, { status: 404 });
    }

    const children = await Technique.find({ parentId: params.id, status: 'published' })
      .sort({ order: 1, 'name.ko': 1 })
      .select('name slug pathSlugs type primaryRole thumbnailUrl videos.url description.ko')
      .lean();

    // 저장된 childrenIds는 어긋날 수 있으므로 실제 parentId 기준으로 센다.
    const counts = children.length
      ? await Technique.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
          { $match: { parentId: { $in: children.map((c) => c._id) }, status: 'published' } },
          { $group: { _id: '$parentId', count: { $sum: 1 } } },
        ])
      : [];
    const countById = new Map(counts.map((c) => [c._id.toString(), c.count]));

    // 루트 분류 이름 (아이콘 선택용): 자신이 루트이면 자기 이름, 아니면 pathSlugs[0]의 이름
    let rootName: string = parent.name.ko;
    if ((parent.pathSlugs || []).length > 0) {
      const root = await Technique.findOne({ slug: parent.pathSlugs[0] }).select('name.ko').lean();
      if (root) rootName = root.name.ko;
    }

    return NextResponse.json({
      success: true,
      data: {
        rootName,
        cards: children.map((c) => ({
          _id: c._id.toString(),
          name: c.name.ko as string,
          href: `/technique/${[...(c.pathSlugs || []), c.slug].join('/')}`,
          type: c.type as string,
          primaryRole: c.primaryRole as string,
          thumbnailUrl: (c.thumbnailUrl as string | undefined) || null,
          summary: summarizeMarkdown(c.description?.ko, 60),
          childCount: countById.get(c._id.toString()) ?? 0,
          hasVideo: (c.videos ?? []).some((v: { url?: string }) => !!v.url?.trim()),
        })),
      },
    });
  } catch (error) {
    console.error('GET child-cards error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load cards' }, { status: 500 });
  }
}
