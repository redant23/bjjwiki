import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';
import { requireAdmin } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    await dbConnect();
    const { id } = await request.json();

    const technique = await Technique.findByIdAndUpdate(
      id,
      { status: 'approved', is_current_version: true },
      { new: true }
    );

    if (!technique) {
      return NextResponse.json({ error: 'Technique not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: technique });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to approve technique' },
      { status: 500 }
    );
  }
}
