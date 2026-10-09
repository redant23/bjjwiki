import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { authOptions } from '@/lib/auth';
import rateLimit from '@/lib/rate-limit';
import { kstDay } from '@/lib/admin-stats';
import Technique from '@/models/Technique';
import TechniqueView from '@/models/TechniqueView';

const DEDUPE_SECONDS = 30 * 60;
const BOT_PATTERN = /bot|crawler|spider|crawling|slurp|headless|preview/i;
const limiter = rateLimit({ interval: 60_000 });

// 상세 페이지 최초 진입 시 한 번 호출되어 조회수를 1 올린다.
// 콘텐츠 수정이 아니므로 updatedAt/contentUpdatedAt은 건드리지 않는다.
// 관리자 세션 / 봇 UA / 30분 내 같은 기술 재방문(쿠키)은 집계하지 않는다.
export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    try {
      await limiter.check(60, ip);
    } catch {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
    }

    const userAgent = request.headers.get('user-agent') ?? '';
    if (!userAgent || BOT_PATTERN.test(userAgent)) {
      return NextResponse.json({ success: true, counted: false });
    }

    const session = await getServerSession(authOptions);
    if (session?.user?.role === 'admin') {
      return NextResponse.json({ success: true, counted: false });
    }

    const cookieName = `tv_${params.id}`;
    const cookieStore = await cookies();
    if (cookieStore.get(cookieName)) {
      return NextResponse.json({ success: true, counted: false });
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

    await TechniqueView.updateOne(
      { technique: params.id, day: kstDay() },
      { $inc: { count: 1 } },
      { upsert: true }
    );

    const response = NextResponse.json({ success: true, counted: true });
    response.cookies.set(cookieName, '1', {
      maxAge: DEDUPE_SECONDS,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/techniques',
    });
    return response;
  } catch (error) {
    console.error('POST view error:', error);
    return NextResponse.json({ success: false, error: 'Failed to count view' }, { status: 500 });
  }
}
