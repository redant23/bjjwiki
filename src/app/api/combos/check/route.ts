import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { buildChainKey, MIN_COMBO_TECHNIQUES } from '@/lib/combo-chain';
import { duplicateInfo, findActiveByChainKey } from '@/lib/combo-service';
import { getViewer, jsonError } from '@/lib/combo-api';

// 등록 폼의 실시간 중복 확인. ?chain=id1,id2,id3 (순서 있음)
export async function GET(request: Request) {
  try {
    const ids = (new URL(request.url).searchParams.get('chain') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length < MIN_COMBO_TECHNIQUES || !ids.every((id) => mongoose.Types.ObjectId.isValid(id))) {
      return NextResponse.json({ success: true, data: { duplicate: null } });
    }
    await dbConnect();
    const existing = await findActiveByChainKey(buildChainKey(ids));
    const viewer = await getViewer();
    return NextResponse.json({
      success: true,
      data: { duplicate: existing ? duplicateInfo(existing, viewer) : null },
    });
  } catch (error) {
    return jsonError(error, 'GET /api/combos/check');
  }
}
