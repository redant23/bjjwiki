import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';
import User from '@/models/User';
import { requireAdmin } from '@/lib/auth';
import { applyTechniqueEdit } from '@/lib/technique-service';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    await dbConnect();
    const technique = await Technique.findById(params.id)
      .populate('parentId', 'name slug')
      .populate('childrenIds', 'name slug type primaryRole')
      .populate('sweepsFromHere', 'name slug')
      .populate('submissionsFromHere', 'name slug')
      .populate('escapesFromHere', 'name slug');

    if (!technique) {
      return NextResponse.json(
        { success: false, error: 'Technique not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: technique });
  } catch {
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
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const body = await request.json();
    const technique = await applyTechniqueEdit(params.id, body);

    if (!technique) {
      return NextResponse.json(
        { success: false, error: 'Technique not found' },
        { status: 404 }
      );
    }

    revalidateTag('technique-tree', 'max');

    return NextResponse.json({ success: true, data: technique });
  } catch (error) {
    console.error('PUT Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update technique' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    await dbConnect();
    const id = params.id;
    const technique = await Technique.findById(id);

    if (!technique) {
      return NextResponse.json(
        { success: false, error: 'Technique not found' },
        { status: 404 }
      );
    }

    // Remove from parent's childrenIds
    if (technique.parentId) {
      await Technique.findByIdAndUpdate(technique.parentId, {
        $pull: { childrenIds: id }
      });
    }

    // Optional: Handle children of this technique (orphan them or delete them?)
    // For now, let's just orphan them (set parentId to null)
    if (technique.childrenIds && technique.childrenIds.length > 0) {
      await Technique.updateMany(
        { _id: { $in: technique.childrenIds } },
        { $set: { parentId: null, level: 1, pathSlugs: [] } }
      );
    }

    await technique.deleteOne();

    // Deleting a technique otherwise leaves it as an orphaned ref inside
    // every user's mySkills — invisible on read (filtered out), but still
    // occupying a signature slot since the cap counts by status alone.
    await User.updateMany(
      { 'mySkills.technique': id },
      { $pull: { mySkills: { technique: id } } }
    );

    revalidateTag('technique-tree', 'max');

    return NextResponse.json({ success: true, data: {} });
  } catch (error) {
    console.error('DELETE Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete technique' },
      { status: 500 }
    );
  }
}
