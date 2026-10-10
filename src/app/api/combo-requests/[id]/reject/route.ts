import { NextResponse } from 'next/server';
import { rejectRequest } from '@/lib/combo-service';
import { FORBIDDEN, getViewer, jsonError, UNAUTHORIZED } from '@/lib/combo-api';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  try {
    const viewer = await getViewer();
    if (!viewer) return UNAUTHORIZED();
    if (!viewer.isAdmin) return FORBIDDEN();

    const body = await request.json().catch(() => ({}));
    await rejectRequest(id, viewer.id, body.reviewNote);
    return NextResponse.json({ success: true, data: {} });
  } catch (error) {
    return jsonError(error, 'POST /api/combo-requests/[id]/reject');
  }
}
