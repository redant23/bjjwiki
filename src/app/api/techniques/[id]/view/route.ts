import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';

// 상세 페이지 최초 진입 시 한 번 호출되어 조회수를 1 올린다.
// 콘텐츠 수정이 아니므로 updatedAt/contentUpdatedAt은 건드리지 않는다.
export async function POST(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
    }

    await dbConnect();
    const result = await Technique.updateOne(
      { _id: params.id, status: 'published' },
      { $inc: { viewCount: 1 } },
      { timestamps: false }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'Technique not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST view error:', error);
    return NextResponse.json({ success: false, error: 'Failed to count view' }, { status: 500 });
  }
}
