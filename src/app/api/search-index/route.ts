import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';
import Combo from '@/models/Combo';
import { listVisibleFilter } from '@/lib/combo-service';
import { getViewer } from '@/lib/combo-api';

// ⌘K 검색용 경량 목록. 등록/수정 직후에도 바로 반영되도록 캐시하지 않는다.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await dbConnect();
    // 대기 중인 콤보는 작성자 본인과 관리자에게만 검색된다.
    const viewer = await getViewer();
    const [techniques, combos] = await Promise.all([
      Technique.find({ status: 'published' })
        .select('_id name aka slug pathSlugs primaryRole level')
        .lean(),
      Combo.find(listVisibleFilter(viewer))
        .select('_id number status techniques demos.performer demos.gearType')
        .lean(),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: {
          techniques: techniques.map((t) => ({
            _id: t._id.toString(),
            name: t.name,
            aka: t.aka,
            slug: t.slug,
            pathSlugs: t.pathSlugs ?? [],
            primaryRole: t.primaryRole,
            level: t.level,
          })),
          combos: combos.map((c) => {
            const demos = c.demos ?? [];
            const performers = [
              ...new Set(demos.map((d) => d.performer).filter((p): p is string => !!p)),
            ];
            const gearTypes = [
              ...new Set(demos.map((d) => d.gearType).filter((g) => g === 'gi' || g === 'nogi')),
            ];
            return {
              _id: c._id.toString(),
              number: typeof c.number === 'number' ? c.number : null,
              status: c.status === 'pending' ? 'pending' : 'published',
              techniques: (c.techniques ?? []).map((id) => id.toString()),
              performers,
              gearTypes,
            };
          }),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('GET /api/search-index error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load search index' },
      { status: 500 }
    );
  }
}
