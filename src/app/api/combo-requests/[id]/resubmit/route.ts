import { NextResponse } from 'next/server';
import { resubmitRequest } from '@/lib/combo-service';
import { getViewer, jsonError, UNAUTHORIZED } from '@/lib/combo-api';

// 반려된 내 요청을 수정해 다시 요청한다. body: { techniques?, demo? }
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  try {
    const viewer = await getViewer();
    if (!viewer) return UNAUTHORIZED();

    const body = await request.json().catch(() => ({}));
    const created = await resubmitRequest(id, viewer, body);
    return NextResponse.json(
      { success: true, data: { requestId: created ? String(created._id) : null } },
      { status: 201 }
    );
  } catch (error) {
    return jsonError(error, 'POST /api/combo-requests/[id]/resubmit');
  }
}
