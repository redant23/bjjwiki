import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';
import User from '@/models/User';
import { requireAdmin } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    await dbConnect();
    const { id } = await request.json();

    const technique = await Technique.findByIdAndDelete(id);

    if (!technique) {
      return NextResponse.json({ error: 'Technique not found' }, { status: 404 });
    }

    await User.updateMany(
      { 'mySkills.technique': id },
      { $pull: { mySkills: { technique: id } } }
    );

    return NextResponse.json({ success: true, message: 'Technique rejected and deleted' });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to reject technique' },
      { status: 500 }
    );
  }
}
