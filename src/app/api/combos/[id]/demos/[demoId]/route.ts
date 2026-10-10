/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { findComboByParam, submitDemoChange } from '@/lib/combo-service';
import { FORBIDDEN, getViewer, jsonError, UNAUTHORIZED } from '@/lib/combo-api';

type Props = { params: Promise<{ id: string; demoId: string }> };

// PATCH /api/combos/:id/demos/:demoId  { performer?, videoUrl?, gearType? }
// 관리자 전용 직접 수정. 보내지 않은 필드는 기존 값을 유지한다. 일반 사용자는 403.
export async function PATCH(request: Request, props: Props) {
  const { id, demoId } = await props.params;
  try {
    const viewer = await getViewer();
    if (!viewer) return UNAUTHORIZED();
    if (!viewer.isAdmin) return FORBIDDEN();

    const body = await request.json().catch(() => ({}));
    // 부분 수정: 현재 값 위에 보낸 필드만 덮어쓴다.
    await dbConnect();
    const combo: any = await findComboByParam(id);
    const current = combo?.demos.find((d: any) => String(d._id) === demoId);
    if (!current) {
      return NextResponse.json({ success: false, error: 'Demo not found' }, { status: 404 });
    }
    const merged = {
      performer: 'performer' in body ? body.performer : current.performer,
      videoUrl: 'videoUrl' in body ? body.videoUrl : current.videoUrl,
      gearType: 'gearType' in body ? body.gearType : current.gearType,
    };
    await submitDemoChange(viewer, id, { type: 'edit_demo', demoId, demo: merged });
    return NextResponse.json({ success: true, data: {} });
  } catch (error) {
    return jsonError(error, 'PATCH /api/combos/[id]/demos/[demoId]');
  }
}

export async function DELETE(_request: Request, props: Props) {
  const { id, demoId } = await props.params;
  try {
    const viewer = await getViewer();
    if (!viewer) return UNAUTHORIZED();
    if (!viewer.isAdmin) return FORBIDDEN();

    await submitDemoChange(viewer, id, { type: 'delete_demo', demoId });
    return NextResponse.json({ success: true, data: {} });
  } catch (error) {
    return jsonError(error, 'DELETE /api/combos/[id]/demos/[demoId]');
  }
}
