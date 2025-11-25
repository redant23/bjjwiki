import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';

export async function POST(request: Request) {
  try {
    await dbConnect();
    const { id } = await request.json();

    const technique = await Technique.findByIdAndDelete(id);

    if (!technique) {
      return NextResponse.json({ error: 'Technique not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Technique rejected and deleted' });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to reject technique' },
      { status: 500 }
    );
  }
}
