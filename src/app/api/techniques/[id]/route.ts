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
    await dbConnect();
    const body = await request.json();
    const id = params.id;

    const currentTechnique = await Technique.findById(id);
    if (!currentTechnique) {
      return NextResponse.json(
        { success: false, error: 'Technique not found' },
        { status: 404 }
      );
    }

    // Handle Parent Change
    if (body.parentId && body.parentId !== currentTechnique.parentId?.toString()) {
      // 1. Remove from old parent
      if (currentTechnique.parentId) {
        await Technique.findByIdAndUpdate(currentTechnique.parentId, {
          $pull: { childrenIds: id }
        });
      }

      // 2. Add to new parent
      const newParent = await Technique.findById(body.parentId);
      if (newParent) {
        await Technique.findByIdAndUpdate(body.parentId, {
          $push: { childrenIds: id }
        });

        // 3. Update level and pathSlugs
        body.level = (newParent.level || 1) + 1;
        body.pathSlugs = [...(newParent.pathSlugs || []), newParent.slug];

        // TODO: Recursively update children's pathSlugs/level if needed
        // For now, we assume this is a leaf node or user accepts inconsistency until re-save
      }
    } else if (body.parentId === null && currentTechnique.parentId) {
      // Moved to root
      await Technique.findByIdAndUpdate(currentTechnique.parentId, {
        $pull: { childrenIds: id }
      });
      body.level = 1;
      body.pathSlugs = [];
    }

    const technique = await Technique.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

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

    return NextResponse.json({ success: true, data: {} });
  } catch (error) {
    console.error('DELETE Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete technique' },
      { status: 500 }
    );
  }
}
