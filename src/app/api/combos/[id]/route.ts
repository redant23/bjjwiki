/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Combo from '@/models/Combo';
import ComboRequest from '@/models/ComboRequest';
import User from '@/models/User';
import {
  adminUpdateTechniques,
  canViewCombo,
  COMBO_POPULATE,
  findComboByParam,
  loadSavedSet,
  serializeCombo,
} from '@/lib/combo-service';
import { FORBIDDEN, getViewer, jsonError, NOT_FOUND, UNAUTHORIZED } from '@/lib/combo-api';

// :id 는 공개 번호(14) 또는 ObjectId. 대기/반려 콤보는 작성자와 관리자에게만 보이고, 그 외에는 404.
export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  try {
    await dbConnect();
    const viewer = await getViewer();
    const found = await findComboByParam(id);
    if (!found || !canViewCombo(found, viewer)) return NOT_FOUND();

    const doc: any = await Combo.findById(found._id).populate([...COMBO_POPULATE]).lean();
    const combo = serializeCombo(doc, viewer, await loadSavedSet(viewer));

    // 내(또는 관리자에게는 전체) 대기 중인 시연 요청 + 이 콤보의 최근 등록 요청 상태(반려 사유 표시용)
    let pendingRequests: unknown[] = [];
    let creation: unknown = null;
    if (viewer) {
      const mineFilter = viewer.isAdmin ? {} : { requestedBy: viewer.id };
      const requests: any[] = await ComboRequest.find({
        combo: found._id,
        status: 'pending',
        type: { $ne: 'create_combo' },
        ...mineFilter,
      })
        .sort({ createdAt: 1 })
        .populate('requestedBy', 'nickname')
        .lean();
      pendingRequests = requests.map((r) => ({
        _id: String(r._id),
        type: r.type,
        demoId: r.payload?.demoId ? String(r.payload.demoId) : null,
        demo: r.payload?.demo ?? null,
        before: r.payload?.before ?? null,
        requestedBy: r.requestedBy ? { _id: String(r.requestedBy._id), nickname: r.requestedBy.nickname } : null,
        createdAt: r.createdAt,
      }));

      if (combo.status !== 'published') {
        const latest: any = await ComboRequest.findOne({ combo: found._id, type: 'create_combo' })
          .sort({ createdAt: -1 })
          .lean();
        if (latest) {
          creation = {
            _id: String(latest._id),
            status: latest.status,
            reviewNote: latest.reviewNote ?? null,
            resubmitted: !!latest.resubmittedAs,
          };
        }
      }
    }

    return NextResponse.json({ success: true, data: { ...combo, pendingRequests, creation } });
  } catch (error) {
    return jsonError(error, 'GET /api/combos/[id]');
  }
}

// 관리자 전용: 기술 순서 오류 수정(번호 유지, chainKey 중복 검사).
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  try {
    const viewer = await getViewer();
    if (!viewer) return UNAUTHORIZED();
    if (!viewer.isAdmin) return FORBIDDEN();

    const body = await request.json().catch(() => ({}));
    if (body.techniques === undefined) {
      return NextResponse.json({ success: false, error: '수정할 내용이 없습니다.' }, { status: 400 });
    }
    const comboId = await adminUpdateTechniques(id, body.techniques);
    return NextResponse.json({ success: true, data: { _id: String(comboId) } });
  } catch (error) {
    return jsonError(error, 'PATCH /api/combos/[id]');
  }
}

// 관리자 전용. 번호는 재사용하지 않으므로 결번이 남는다.
export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  try {
    const viewer = await getViewer();
    if (!viewer) return UNAUTHORIZED();
    if (!viewer.isAdmin) return FORBIDDEN();

    await dbConnect();
    const combo = await findComboByParam(id);
    if (!combo) return NOT_FOUND();

    await combo.deleteOne();
    // 저장 기록 / 대기 중 요청 정리
    await User.updateMany(
      { savedCombos: combo._id },
      { $pull: { savedCombos: combo._id, savedComboLog: { combo: combo._id } } }
    );
    await ComboRequest.updateMany(
      { combo: combo._id, status: 'pending' },
      { $set: { status: 'cancelled' }, $unset: { dedupeKey: 1 } }
    );

    return NextResponse.json({ success: true, data: {} });
  } catch (error) {
    return jsonError(error, 'DELETE /api/combos/[id]');
  }
}
