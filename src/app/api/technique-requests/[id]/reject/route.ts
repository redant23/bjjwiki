import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import TechniqueRequest from '@/models/TechniqueRequest';
import Notification from '@/models/Notification';
import { requireAdmin } from '@/lib/auth';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const { session, error: authError } = await requireAdmin();
    if (authError) return authError;

    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request id' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const reviewNote = typeof body.reviewNote === 'string' ? body.reviewNote.trim() : '';
    if (!reviewNote) {
      return NextResponse.json(
        { success: false, error: 'reviewNote is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    const techniqueRequest = await TechniqueRequest.findById(params.id);
    if (!techniqueRequest) {
      return NextResponse.json(
        { success: false, error: 'Request not found' },
        { status: 404 }
      );
    }
    if (techniqueRequest.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Request is not pending' },
        { status: 409 }
      );
    }

    techniqueRequest.status = 'rejected';
    techniqueRequest.reviewedBy = new mongoose.Types.ObjectId(session!.user.id);
    techniqueRequest.reviewNote = reviewNote;
    await techniqueRequest.save();

    try {
      await Notification.create({
        user: techniqueRequest.submittedBy,
        type: 'request_rejected',
        message: `요청이 반려되었습니다: ${reviewNote}`,
        relatedRequestId: techniqueRequest._id,
        isRead: false,
      });

      await Notification.updateMany(
        { relatedRequestId: techniqueRequest._id, type: 'new_request', isRead: false },
        { $set: { isRead: true } }
      );
    } catch (notifyError) {
      console.error('Failed to notify submitter of rejection:', notifyError);
    }

    return NextResponse.json({ success: true, data: techniqueRequest });
  } catch (error) {
    console.error('POST /api/technique-requests/[id]/reject error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reject request' },
      { status: 500 }
    );
  }
}
