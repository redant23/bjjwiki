import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ComboRequest from '@/models/ComboRequest';
import { submitDemoChange } from '@/lib/combo-service';
import { getViewer, jsonError, UNAUTHORIZED } from '@/lib/combo-api';

/* eslint-disable @typescript-eslint/no-explicit-any */
function serializeRequest(r: any) {
  const combo = r.combo && typeof r.combo === 'object' ? r.combo : null;
  return {
    _id: String(r._id),
    type: r.type,
    status: r.status,
    payload: {
      demo: r.payload?.demo ?? null,
      demoId: r.payload?.demoId ? String(r.payload.demoId) : null,
      before: r.payload?.before ?? null,
    },
    combo: combo
      ? {
          _id: String(combo._id),
          number: typeof combo.number === 'number' ? combo.number : null,
          status: combo.status ?? 'published',
          techniques: (combo.techniques ?? [])
            .filter((t: any) => t && t.name)
            .map((t: any) => ({ _id: String(t._id), name: t.name })),
          demos: (combo.demos ?? []).map((d: any) => ({
            _id: String(d._id),
            performer: d.performer,
            videoUrl: d.videoUrl,
            gearType: d.gearType,
          })),
        }
      : null,
    requestedBy: r.requestedBy?.nickname
      ? { _id: String(r.requestedBy._id), nickname: r.requestedBy.nickname }
      : null,
    reviewNote: r.reviewNote ?? null,
    resultNumber: r.resultNumber ?? null,
    resubmitted: !!r.resubmittedAs,
    createdAt: r.createdAt,
    reviewedAt: r.reviewedAt ?? null,
  };
}

// 내 요청(?mine=1) 또는 관리자 전체 목록. ?status=pending,approved,...
export async function GET(request: Request) {
  try {
    const viewer = await getViewer();
    if (!viewer) return UNAUTHORIZED();
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const statuses = (searchParams.get('status') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const query: Record<string, unknown> = {};
    if (statuses.length) query.status = { $in: statuses };
    if (!viewer.isAdmin || searchParams.get('mine') === '1') query.requestedBy = viewer.id;

    const docs: any[] = await ComboRequest.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate({
        path: 'combo',
        select: 'number status techniques demos',
        populate: { path: 'techniques', select: 'name' },
      })
      .populate('requestedBy', 'nickname')
      .lean();

    return NextResponse.json({ success: true, data: docs.map(serializeRequest) });
  } catch (error) {
    return jsonError(error, 'GET /api/combo-requests');
  }
}

// 시연 추가/수정/삭제 요청. 관리자가 보내면 즉시 반영된다. 콤보 등록은 POST /api/combos.
export async function POST(request: Request) {
  try {
    const viewer = await getViewer();
    if (!viewer) return UNAUTHORIZED();

    const body = await request.json().catch(() => ({}));
    const type = body.type;
    if (type !== 'add_demo' && type !== 'edit_demo' && type !== 'delete_demo') {
      return NextResponse.json({ success: false, error: '요청 유형이 올바르지 않습니다.' }, { status: 400 });
    }
    if (typeof body.comboId !== 'string' || !body.comboId) {
      return NextResponse.json({ success: false, error: '콤보를 지정해주세요.' }, { status: 400 });
    }

    const result = await submitDemoChange(viewer, body.comboId, {
      type,
      demoId: typeof body.demoId === 'string' ? body.demoId : undefined,
      demo: body.demo,
    });

    return NextResponse.json(
      {
        success: true,
        data: { applied: result.applied, requestId: result.request ? String(result.request._id) : null },
      },
      { status: result.applied ? 200 : 201 }
    );
  } catch (error) {
    return jsonError(error, 'POST /api/combo-requests');
  }
}
