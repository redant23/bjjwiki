import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { findSimilarTechniquesInDb } from '@/lib/technique-service';

// 입력한 이름/별칭과 같거나 비슷한 기존 기술을 찾는다. 관리자에게만 안내하는 경고용이며
// 저장을 막지 않는다. 읽기 전용이지만 입력이 길어 GET 대신 POST body로 받는다.
export async function POST(request: Request) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const body = await request.json();
    const toList = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 20) : [];

    const data = await findSimilarTechniquesInDb(
      {
        name: {
          ko: typeof body.name?.ko === 'string' ? body.name.ko : undefined,
          en: typeof body.name?.en === 'string' ? body.name.en : undefined,
        },
        aka: { ko: toList(body.aka?.ko), en: toList(body.aka?.en) },
      },
      typeof body.excludeId === 'string' ? body.excludeId : undefined
    );

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('POST /api/admin/similar-techniques error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search similar techniques' },
      { status: 500 }
    );
  }
}
