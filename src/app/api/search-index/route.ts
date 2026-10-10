import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';
import Combo from '@/models/Combo';

// ⌘K 검색용 경량 목록. 등록/수정 직후에도 바로 반영되도록 캐시하지 않는다.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await dbConnect();
    const [techniques, combos] = await Promise.all([
      Technique.find({ status: 'published' })
        .select('_id name aka slug pathSlugs primaryRole level')
        .lean(),
      Combo.find().select('_id name techniques gearType').lean(),
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
          combos: combos.map((c) => ({
            _id: c._id.toString(),
            name: c.name,
            techniques: (c.techniques ?? []).map((id) => id.toString()),
            gearType: c.gearType,
          })),
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
