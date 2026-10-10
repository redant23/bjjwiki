import { NextResponse } from 'next/server';
import { cancelRequest } from '@/lib/combo-service';
import { getViewer, jsonError, UNAUTHORIZED } from '@/lib/combo-api';

// 작성자(또는 관리자)가 대기 중인 요청을 취소한다.
export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  try {
    const viewer = await getViewer();
    if (!viewer) return UNAUTHORIZED();

    await cancelRequest(id, viewer);
    return NextResponse.json({ success: true, data: {} });
  } catch (error) {
    return jsonError(error, 'POST /api/combo-requests/[id]/cancel');
  }
}
