import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Technique, { ITechnique } from '@/models/Technique';
import rateLimit from '@/lib/rate-limit';
import mongoose from 'mongoose';

const limiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  uniqueTokenPerInterval: 500, // Max 500 users per second
});

// Simple slugify function
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-');  // Replace multiple - with single -
}

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = { status };

    if (slug) query.slug = slug;
    if (parentId) query.parentId = parentId;
    if (level) query.level = parseInt(level);
    if (isCorePosition) query.isCorePosition = isCorePosition === 'true';
    if (type) query.type = type;
    if (primaryRole) query.primaryRole = primaryRole;

    if (search) {
      query.$or = [
        { 'name.ko': { $regex: search, $options: 'i' } },
        { 'name.en': { $regex: search, $options: 'i' } },
        { 'aka.ko': { $regex: search, $options: 'i' } },
        { 'aka.en': { $regex: search, $options: 'i' } },
        { 'description.ko': { $regex: search, $options: 'i' } },
        { 'description.en': { $regex: search, $options: 'i' } },
      ];
    }

    const techniques = await Technique.find(query).sort({ 'name.ko': 1 });

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
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

    try {
      await limiter.check(10, ip); // 10 requests per minute per IP
    } catch {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    await dbConnect();
    const body = await request.json();

    // 1. Generate Slug if not provided
    if (!body.slug) {
      const nameForSlug = body.name?.en || body.name?.ko || 'untitled';
      let generatedSlug = slugify(nameForSlug);

      // Ensure uniqueness (simple check)
      let counter = 1;
      while (await Technique.findOne({ slug: generatedSlug })) {
        generatedSlug = `${slugify(nameForSlug)}-${counter}`;
        counter++;
      }
      body.slug = generatedSlug;
    }

    // 2. Handle Hierarchy
    if (body.parentId) {
      const parent = await Technique.findById(body.parentId);
      if (!parent) {
        return NextResponse.json(
          { success: false, error: 'Parent technique not found' },
          { status: 400 }
        );
      }
      body.level = (parent.level || 1) + 1;
      body.pathSlugs = [...(parent.pathSlugs || []), parent.slug];
    } else {
      body.level = 1;
      body.pathSlugs = [];
    }

    // 3. Create Technique
    const technique = await Technique.create({
      ...body,
      status: body.status || 'draft', // Default to draft
    }) as unknown as ITechnique;

    // 4. Update Parent's childrenIds
    if (body.parentId) {
      await Technique.findByIdAndUpdate(body.parentId, {
        $push: { childrenIds: technique._id }
      });
    }

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
