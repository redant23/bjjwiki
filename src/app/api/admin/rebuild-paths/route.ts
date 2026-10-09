import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { rebuildTechniquePaths } from '@/lib/technique-service';

// 전체 기술의 pathSlugs/level을 parentId 기준으로 다시 계산한다.
// POST /api/admin/rebuild-paths?dryRun=1 → 어긋난 항목만 보고하고 DB는 수정하지 않는다.
export async function POST(request: Request) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';
    const result = await rebuildTechniquePaths({ dryRun });

    if (!dryRun && result.updated > 0) {
      revalidateTag('technique-tree', { expire: 0 });
    }

    return NextResponse.json({ success: true, dryRun, data: result });
  } catch (error) {
    console.error('rebuild-paths failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to rebuild paths' },
      { status: 500 }
    );
  }
}
