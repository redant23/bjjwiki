import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Notification from '@/models/Notification';
import { requireAuth } from '@/lib/auth';

export async function POST() {
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    await dbConnect();

    await Notification.updateMany(
      { user: session!.user.id, isRead: false },
      { $set: { isRead: true } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/notifications/read-all error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update notifications' },
      { status: 500 }
    );
  }
}
