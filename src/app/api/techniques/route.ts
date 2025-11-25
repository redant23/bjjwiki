import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';
import rateLimit from '@/lib/rate-limit';

const limiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  uniqueTokenPerInterval: 500, // Max 500 users per second
});

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status') || 'approved';
    const search = searchParams.get('search');

    const query: any = { status };

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { alt_names: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const techniques = await Technique.find(query).sort({ name: 1 });

    return NextResponse.json({ success: true, data: techniques });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch techniques' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Basic rate limiting based on IP
    // In Next.js App Router, getting IP can be tricky in dev, 
    // but we can try headers or just use a placeholder for now if headers are missing.
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

    try {
      await limiter.check(5, ip); // 5 requests per minute per IP
    } catch {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    await dbConnect();
    const body = await request.json();

    // Default to pending status for new submissions
    const technique = await Technique.create({
      ...body,
      status: 'pending',
    });

    return NextResponse.json({ success: true, data: technique }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create technique' },
      { status: 400 }
    );
  }
}
