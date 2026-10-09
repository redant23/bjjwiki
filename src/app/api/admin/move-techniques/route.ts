import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import mongoose from 'mongoose';
import { requireAdmin } from '@/lib/auth';
import { moveTechniques } from '@/lib/technique-service';

const MAX_IDS = 200;

// 여러 기술을 한 상위 기술(newParentId, null이면 최상위) 아래로 일괄 이동한다.
// body: { ids: string[], newParentId: string | null, dryRun?: boolean }
// dryRun이면 DB를 수정하지 않고 이동 대상/건너뜀/주소가 바뀌는 기술 수만 보고한다.
export async function POST(request: Request) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const body = await request.json();
    const ids: unknown = body?.ids;
    const newParentId: unknown = body?.newParentId ?? null;

    if (
      !Array.isArray(ids) ||
      ids.length > MAX_IDS ||
      !ids.every((id) => typeof id === 'string' && mongoose.isValidObjectId(id))
    ) {
      return NextResponse.json(
        { success: false, error: `이동할 기술은 ${MAX_IDS}개 이하의 유효한 ID여야 합니다.` },
        { status: 400 }
      );
    }
    if (newParentId !== null && !(typeof newParentId === 'string' && mongoose.isValidObjectId(newParentId))) {
      return NextResponse.json({ success: false, error: '상위 기술 ID가 올바르지 않습니다.' }, { status: 400 });
    }

    const dryRun = body?.dryRun === true;
    const result = await moveTechniques(ids as string[], newParentId as string | null, { dryRun });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error, code: result.code }, { status: 400 });
    }

    if (!dryRun && result.moved > 0) {
      revalidateTag('technique-tree', { expire: 0 });
    }
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('POST /api/admin/move-techniques error:', error);
    return NextResponse.json({ success: false, error: 'Failed to move techniques' }, { status: 500 });
  }
}
