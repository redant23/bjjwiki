import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import dbConnect from '@/lib/db';
import Announcement from '@/models/Announcement';
import { requireAdmin } from '@/lib/auth';
import { announcementState, parseAnnouncementBody } from '@/lib/announcement';

// 관리 화면용 전체 목록 (숨김/만료 포함, 최신순)
export async function GET() {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    await dbConnect();
    const docs = await Announcement.find().sort({ createdAt: -1 }).limit(100).lean();
    const now = new Date();
    return NextResponse.json({
      success: true,
      data: docs.map((d) => ({
        _id: d._id.toString(),
        text: d.text,
        href: d.href || null,
        active: d.active,
        expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
        createdAt: d.createdAt.toISOString(),
        state: announcementState(d, now),
      })),
    });
  } catch (error) {
    console.error('GET /api/admin/announcements error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load announcements' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { session, error: authError } = await requireAdmin();
    if (authError) return authError;

    const parsed = parseAnnouncementBody(await request.json(), false);
    if (!parsed.ok) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }

    await dbConnect();
    const created = await Announcement.create({ ...parsed.value, createdBy: session!.user.id });
    revalidateTag('announcements', { expire: 0 });

    return NextResponse.json({ success: true, data: { _id: created._id.toString() } }, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/announcements error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create announcement' }, { status: 500 });
  }
}
