import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import TechniqueRequest from '@/models/TechniqueRequest';
import { requireAuth } from '@/lib/auth';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request id' },
        { status: 400 }
      );
    }

    await dbConnect();

    const techniqueRequest = await TechniqueRequest.findById(params.id)
      .populate('submittedBy', 'nickname email')
      .populate('reviewedBy', 'nickname')
      .populate('targetTechniqueId');

    if (!techniqueRequest) {
      return NextResponse.json(
        { success: false, error: 'Request not found' },
        { status: 404 }
      );
    }

    const submittedBy = techniqueRequest.submittedBy as unknown as { _id: mongoose.Types.ObjectId };
    const isOwner = submittedBy._id.toString() === session!.user.id;
    if (session!.user.role !== 'admin' && !isOwner) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: techniqueRequest });
  } catch (error) {
    console.error('GET /api/technique-requests/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch request' },
      { status: 500 }
    );
  }
}
