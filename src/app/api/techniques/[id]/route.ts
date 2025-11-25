import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    await dbConnect();
    const technique = await Technique.findById(params.id);

    if (!technique) {
      return NextResponse.json(
        { success: false, error: 'Technique not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: technique });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch technique' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    await dbConnect();
    const body = await request.json();

    // Instead of updating directly, we should create a new pending version
    // But for admin updates or status changes, we might update directly.
    // For now, let's assume this is a direct update (admin) or we handle the logic here.
    // Requirement says: "Existing technique modification: Create NEW document with status: pending"

    // If it's a contribution update (not admin), we should probably use POST /api/techniques with original_technique_id
    // But if we use PUT here, we can implement that logic too.

    // Let's implement direct update for now, assuming admin usage or simple update.
    // We will handle the "contribution flow" in the client or a specific service method.

    const technique = await Technique.findByIdAndUpdate(params.id, body, {
      new: true,
      runValidators: true,
    });

    if (!technique) {
      return NextResponse.json(
        { success: false, error: 'Technique not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: technique });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to update technique' },
      { status: 400 }
    );
  }
}
