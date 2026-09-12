import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import TechniqueRequest from '@/models/TechniqueRequest';
import Notification from '@/models/Notification';
import { requireAdmin } from '@/lib/auth';
import { createTechniqueFromPayload, applyTechniqueEdit } from '@/lib/technique-service';

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

    if (techniqueRequest.type === 'create') {
      await createTechniqueFromPayload({
        ...techniqueRequest.payload,
        status: 'published',
      });
    } else {
      const targetId = techniqueRequest.targetTechniqueId?.toString();
      if (!targetId) {
        return NextResponse.json(
          { success: false, error: 'Missing target technique' },
          { status: 400 }
        );
      }

      const updated = await applyTechniqueEdit(targetId, techniqueRequest.payload);
      if (!updated) {
        // 대상 기술이 그 사이 삭제된 경우: 승인 대신 자동 반려 처리
        techniqueRequest.status = 'rejected';
        techniqueRequest.reviewedBy = new mongoose.Types.ObjectId(session!.user.id);
        techniqueRequest.reviewNote = '대상 기술이 삭제되어 자동으로 반려되었습니다.';
        await techniqueRequest.save();

        await Notification.create({
          user: techniqueRequest.submittedBy,
          type: 'request_rejected',
          message: `수정 요청이 반려되었습니다: ${techniqueRequest.reviewNote}`,
          relatedRequestId: techniqueRequest._id,
          isRead: false,
        });

        await Notification.updateMany(
          { relatedRequestId: techniqueRequest._id, type: 'new_request', isRead: false },
          { $set: { isRead: true } }
        );

        return NextResponse.json(
          { success: false, error: techniqueRequest.reviewNote },
          { status: 409 }
        );
      }
    }

    techniqueRequest.status = 'approved';
    techniqueRequest.reviewedBy = new mongoose.Types.ObjectId(session!.user.id);
    await techniqueRequest.save();

    await Notification.create({
      user: techniqueRequest.submittedBy,
      type: 'request_approved',
      message:
        techniqueRequest.type === 'create'
          ? '등록 요청하신 기술이 승인되어 게시되었습니다.'
          : '수정 요청하신 내용이 승인되어 반영되었습니다.',
      relatedRequestId: techniqueRequest._id,
      isRead: false,
    });

    // 다른 관리자들에게 갔던 "새 요청" 알림도 함께 읽음 처리 (안 그러면 벨이 계속 켜져 있음)
    await Notification.updateMany(
      { relatedRequestId: techniqueRequest._id, type: 'new_request', isRead: false },
      { $set: { isRead: true } }
    );

    return NextResponse.json({ success: true, data: techniqueRequest });
  } catch (error) {
    console.error('POST /api/technique-requests/[id]/approve error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve request' },
      { status: 500 }
    );
  }
}
