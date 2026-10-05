import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';
import { requireAdmin } from '@/lib/auth';
import { getQualityIssues, QualityIssue } from '@/lib/technique-quality';

// 미완성 기술 목록 (영상 없음 / 썸네일 없음 / 제목 구조 부족).
// ?status=published(기본) | draft | all
export async function GET(request: Request) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const statusParam = new URL(request.url).searchParams.get('status') || 'published';
    const query = statusParam === 'all' ? {} : { status: statusParam };

    await dbConnect();
    const techniques = await Technique.find(query)
      .select('name slug pathSlugs primaryRole status videos thumbnailUrl description.ko contentUpdatedAt')
      .lean();

    const counts: Record<QualityIssue, number> = { no_video: 0, no_thumbnail: 0, weak_structure: 0 };
    const items = [];

    for (const t of techniques) {
      const { issues, headingCount } = getQualityIssues({
        videos: t.videos,
        thumbnailUrl: t.thumbnailUrl,
        description: t.description?.ko,
      });
      if (issues.length === 0) continue;
      for (const issue of issues) counts[issue]++;
      items.push({
        _id: t._id.toString(),
        name: t.name.ko,
        href: `/technique/${[...(t.pathSlugs || []), t.slug].join('/')}`,
        primaryRole: t.primaryRole,
        status: t.status,
        issues,
        headingCount,
        contentUpdatedAt: t.contentUpdatedAt ? t.contentUpdatedAt.toISOString() : null,
      });
    }

    // 문제가 많은 기술부터, 같으면 이름순
    items.sort((a, b) => b.issues.length - a.issues.length || a.name.localeCompare(b.name, 'ko'));

    return NextResponse.json({
      success: true,
      data: { total: techniques.length, incomplete: items.length, counts, items },
    });
  } catch (error) {
    console.error('GET /api/admin/quality error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load quality report' },
      { status: 500 }
    );
  }
}
