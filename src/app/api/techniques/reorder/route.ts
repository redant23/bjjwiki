import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';

export async function PUT(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { items } = body; // Array of { _id: string, order: number }

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { success: false, error: 'Invalid data format' },
        { status: 400 }
      );
    }

    // Bulk write for better performance
    const operations = items.map((item) => ({
      updateOne: {
        filter: { _id: item._id },
        update: { $set: { order: item.order } },
      },
    }));

    if (operations.length > 0) {
      await Technique.bulkWrite(operations);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reorder failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reorder techniques' },
      { status: 500 }
    );
  }
}
