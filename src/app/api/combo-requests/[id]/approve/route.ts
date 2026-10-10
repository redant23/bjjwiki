import { NextResponse } from 'next/server';
import { approveRequest } from '@/lib/combo-service';
import { FORBIDDEN, getViewer, jsonError, UNAUTHORIZED } from '@/lib/combo-api';

// 관리자 승인. body: { techniques?, demo? } 를 주면 "수정 후 승인"으로 값을 고쳐 반영한다.
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  try {
    const viewer = await getViewer();
    if (!viewer) return UNAUTHORIZED();
    if (!viewer.isAdmin) return FORBIDDEN();

    const body = await request.json().catch(() => ({}));
    const { number } = await approveRequest(id, viewer.id, {
      techniques: body.techniques,
      demo: body.demo,
    });
    return NextResponse.json({ success: true, data: { number } });
  } catch (error) {
    return jsonError(error, 'POST /api/combo-requests/[id]/approve');
  }
}
