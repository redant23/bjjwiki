/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Combo from '@/models/Combo';
import User from '@/models/User';
import {
  COMBO_POPULATE,
  listVisibleFilter,
  loadSavedSet,
  serializeCombo,
  submitCombo,
} from '@/lib/combo-service';
import { getViewer, jsonError, UNAUTHORIZED } from '@/lib/combo-api';

// 목록: 공개된 콤보 + 본인의 승인 대기 콤보(관리자는 모든 대기 콤보).
// ?sort=recent(공개일 최신순) | popular(기본) ?saved=1(내가 저장한 콤보만, 최근 저장순)
export async function GET(request: Request) {
  try {
    await dbConnect();
    const viewer = await getViewer();
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort') === 'recent' ? 'recent' : 'popular';
    const savedOnly = searchParams.get('saved') === '1';

    const filter: Record<string, unknown> = listVisibleFilter(viewer);
    let savedAtById = new Map<string, number>();
    if (savedOnly) {
      if (!viewer) return UNAUTHORIZED();
      const user: any = await User.findById(viewer.id).select('savedCombos savedComboLog').lean();
      const ids = (user?.savedCombos ?? []).map((id: any) => String(id));
      savedAtById = new Map<string, number>(
        (user?.savedComboLog ?? []).map((l: any) => [String(l.combo), new Date(l.savedAt).getTime()])
      );
      filter.$and = [{ _id: { $in: ids } }, { status: { $nin: ['pending', 'rejected'] } }];
    }

    const docs: any[] = await Combo.find(filter)
      .populate([...COMBO_POPULATE].slice(0, 2))
      .lean();

    const savedSet = await loadSavedSet(viewer);
    const items = docs.map((doc) => serializeCombo(doc, viewer, savedSet));

    const popularity = (a: any, b: any) =>
      b.saveCount - a.saveCount || (b.number ?? 0) - (a.number ?? 0);
    const recency = (a: any, b: any) =>
      new Date(b.publishedAt ?? b.createdAt ?? 0).getTime() -
        new Date(a.publishedAt ?? a.createdAt ?? 0).getTime() || (b.number ?? 0) - (a.number ?? 0);

    if (savedOnly) {
      // 저장 시각이 기록된 것은 최근 저장순, 기록이 없는 기존 저장분은 그 뒤에 콤보 번호순.
      items.sort((a, b) => {
        const ta = savedAtById.get(a._id);
        const tb = savedAtById.get(b._id);
        if (ta !== undefined && tb !== undefined) return tb - ta;
        if (ta !== undefined) return -1;
        if (tb !== undefined) return 1;
        return (a.number ?? 0) - (b.number ?? 0);
      });
    } else {
      items.sort(sort === 'recent' ? recency : popularity);
    }

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    return jsonError(error, 'GET /api/combos');
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();
    if (!viewer) return UNAUTHORIZED();

    const body = await request.json().catch(() => ({}));
    const { combo, request: comboRequest, published } = await submitCombo(viewer, body);

    return NextResponse.json(
      {
        success: true,
        data: {
          _id: String(combo._id),
          number: combo.number ?? null,
          status: combo.status,
          requestId: comboRequest ? String(comboRequest._id) : null,
          published,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return jsonError(error, 'POST /api/combos');
  }
}
