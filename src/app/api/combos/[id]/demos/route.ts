import { NextResponse } from 'next/server';
import { submitDemoChange } from '@/lib/combo-service';
import { FORBIDDEN, getViewer, jsonError, UNAUTHORIZED } from '@/lib/combo-api';

// 관리자 전용 직접 반영 API. 일반 사용자는 POST /api/combo-requests 로 요청해야 한다.
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  try {
    const viewer = await getViewer();
    if (!viewer) return UNAUTHORIZED();
    if (!viewer.isAdmin) return FORBIDDEN();

    const body = await request.json().catch(() => ({}));
    await submitDemoChange(viewer, id, { type: 'add_demo', demo: body });
    return NextResponse.json({ success: true, data: {} }, { status: 201 });
  } catch (error) {
    return jsonError(error, 'POST /api/combos/[id]/demos');
  }
}
