import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import TechniqueRequest from '@/models/TechniqueRequest';
import Technique from '@/models/Technique';
import User from '@/models/User';
import Notification from '@/models/Notification';
import { requireAuth } from '@/lib/auth';
import { pickTechniquePayload } from '@/lib/technique-service';
import rateLimit from '@/lib/rate-limit';

const limiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});

export async function POST(request: Request) {
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    try {
      await limiter.check(5, session!.user.id);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    await dbConnect();
    const body = await request.json();

    if (body.type !== 'create' && body.type !== 'edit') {
      return NextResponse.json(
        { success: false, error: 'type must be "create" or "edit"' },
        { status: 400 }
      );
    }

    let targetTechniqueId: string | null = null;

    if (body.type === 'edit') {
      if (!body.targetTechniqueId || !mongoose.isValidObjectId(body.targetTechniqueId)) {
        return NextResponse.json(
          { success: false, error: 'targetTechniqueId is required for edit requests' },
          { status: 400 }
        );
      }

      const target = await Technique.findById(body.targetTechniqueId);
      if (!target) {
        return NextResponse.json(
          { success: false, error: 'Target technique not found' },
          { status: 404 }
        );
      }

      const duplicate = await TechniqueRequest.findOne({
        type: 'edit',
        targetTechniqueId: body.targetTechniqueId,
        submittedBy: session!.user.id,
        status: 'pending',
      });
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: '이미 이 기술에 대한 대기 중인 수정 요청이 있습니다.' },
          { status: 409 }
        );
      }

      targetTechniqueId = body.targetTechniqueId;
    }

    const payload = pickTechniquePayload(body.payload || {});
    if (Object.keys(payload).length === 0) {
      return NextResponse.json(
        { success: false, error: 'payload is empty' },
        { status: 400 }
      );
    }

    const techniqueRequest = await TechniqueRequest.create({
      type: body.type,
      targetTechniqueId,
      payload,
      status: 'pending',
      submittedBy: new mongoose.Types.ObjectId(session!.user.id),
    });

    try {
      const admins = await User.find({ role: 'admin' }).select('_id');
      if (admins.length > 0) {
        await Notification.insertMany(
          admins.map((admin) => ({
            user: admin._id,
            type: 'new_request' as const,
            message:
              body.type === 'create'
                ? '새로운 기술 등록 요청이 도착했습니다.'
                : '새로운 기술 수정 요청이 도착했습니다.',
            relatedRequestId: techniqueRequest._id,
            isRead: false,
          }))
        );
      }
    } catch (notifyError) {
      console.error('Failed to notify admins of new technique request:', notifyError);
    }

    return NextResponse.json({ success: true, data: techniqueRequest }, { status: 201 });
  } catch (error) {
    console.error('POST /api/technique-requests error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit request' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    await dbConnect();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const mine = searchParams.get('mine');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {};
    if (status) query.status = status;

    if (session!.user.role !== 'admin' || mine === '1') {
      query.submittedBy = session!.user.id;
    }

    const requests = await TechniqueRequest.find(query)
      .sort({ createdAt: -1 })
      .populate('submittedBy', 'nickname email')
      .populate('targetTechniqueId', 'name slug pathSlugs')
      .populate('reviewedBy', 'nickname');

    return NextResponse.json({ success: true, data: requests });
  } catch (error) {
    console.error('GET /api/technique-requests error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}
