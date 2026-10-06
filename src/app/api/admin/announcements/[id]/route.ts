import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Announcement from '@/models/Announcement';
import { requireAdmin } from '@/lib/auth';
import { parseAnnouncementBody } from '@/lib/announcement';

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
    }
    const parsed = parseAnnouncementBody(await request.json(), true);
    if (!parsed.ok) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }
    if (Object.keys(parsed.value).length === 0) {
      return NextResponse.json({ success: false, error: '변경할 내용이 없습니다.' }, { status: 400 });
    }

    await dbConnect();
    const updated = await Announcement.findByIdAndUpdate(params.id, { $set: parsed.value }, { new: true });
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Announcement not found' }, { status: 404 });
    }
    revalidateTag('announcements', 'max');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/admin/announcements/[id] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update announcement' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
    }

    await dbConnect();
    const deleted = await Announcement.findByIdAndDelete(params.id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Announcement not found' }, { status: 404 });
    }
    revalidateTag('announcements', 'max');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/admin/announcements/[id] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete announcement' }, { status: 500 });
  }
}
