import { NextResponse } from 'next/server';
import { getRoleTagCounts } from '@/lib/technique-service';

// 기존 기술에 쓰인 Role Tag와 사용 횟수 (많이 쓰인 순). 폼 자동완성용.
export async function GET() {
  try {
    const data = await getRoleTagCounts();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('GET role-tags error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch role tags' },
      { status: 500 }
    );
  }
}
