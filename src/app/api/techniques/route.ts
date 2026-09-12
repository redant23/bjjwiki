import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';
import rateLimit from '@/lib/rate-limit';
import { requireAdmin } from '@/lib/auth';
import { createTechniqueFromPayload } from '@/lib/technique-service';

const limiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  uniqueTokenPerInterval: 500, // Max 500 users per second
});

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);

    // Filters
    const slug = searchParams.get('slug');
    const parentId = searchParams.get('parentId');
    const level = searchParams.get('level');
    const isCorePosition = searchParams.get('isCorePosition');
    const type = searchParams.get('type');
    const primaryRole = searchParams.get('primaryRole');
    const status = searchParams.get('status') || 'published'; // Default to published
    const search = searchParams.get('search');
    const fields = searchParams.get('fields');

    // Additional params for optimized filtering
    const category = searchParams.get('category');
    const difficulty = searchParams.get('difficulty');
    const position = searchParams.get('position');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = { status };

    // Apply basic filters
    if (slug) query.slug = slug;
    if (parentId) query.parentId = parentId;
    if (level) query.level = parseInt(level);
    if (isCorePosition) query.isCorePosition = isCorePosition === 'true';
    if (type) query.type = type;
    if (primaryRole) query.primaryRole = primaryRole;

    if (search) {
      // Use text search if available, otherwise regex on indexed fields
      // Note: Text search is most efficient but requires $text operator
      query.$text = { $search: search };
    }

    if (category) {
      // Use pathSlugs index for category filtering (more efficient than regex on ID)
      query.pathSlugs = category;
    }

    if (difficulty) {
      query.difficulty = parseInt(difficulty);
    }

    if (position) {
      query.primaryRole = 'position';
      // If specific position type is needed, add it here
    }

    // Optimize sort based on available indexes
    let sortOptions: any = { order: 1, 'name.ko': 1 }; // Default sort (uses { order: 1 } index partially)

    // If sorting by level, use compound index { level: 1, order: 1 }
    // sortOptions = { level: 1, order: 1 }; 

    let queryBuilder = Technique.find(query).sort(sortOptions).lean(); // Use lean() for performance

    if (fields === 'light') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      queryBuilder = queryBuilder.select('_id name slug parentId pathSlugs primaryRole type order') as any;
    }

    const techniques = await queryBuilder;

    return NextResponse.json({ success: true, data: techniques });
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch techniques' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

    try {
      await limiter.check(10, ip); // 10 requests per minute per IP
    } catch {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const technique = await createTechniqueFromPayload({
      ...body,
      status: body.status || 'draft',
    });

    revalidateTag('technique-tree', 'max');

    return NextResponse.json({ success: true, data: technique }, { status: 201 });
  } catch (error: unknown) {
    console.error('POST Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create technique';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  }
}
