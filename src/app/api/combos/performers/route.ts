import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Combo from '@/models/Combo';
import { PUBLISHED_FILTER } from '@/lib/combo-service';
import { jsonError } from '@/lib/combo-api';

// 시연 폼 자동완성용: 공개된 콤보에 이미 쓰인 시전자 이름(표기 통일).
export async function GET() {
  try {
    await dbConnect();
    const names: string[] = await Combo.distinct('demos.performer', PUBLISHED_FILTER);
    const sorted = names.filter((n) => typeof n === 'string' && n).sort((a, b) => a.localeCompare(b, 'ko'));
    return NextResponse.json({ success: true, data: sorted });
  } catch (error) {
    return jsonError(error, 'GET /api/combos/performers');
  }
}
