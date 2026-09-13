import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Technique, { ITechnique } from '@/models/Technique';
import { unstable_cache } from 'next/cache';

export const getTechniqueTree = unstable_cache(
  async () => {
    await dbConnect();

    // Fetch only necessary fields for the sidebar
    const techniques = await Technique.find({ status: 'published' })
      .select('_id name slug parentId pathSlugs order level')
      .sort({ order: 1, 'name.ko': 1 })
      .lean();

    // Convert _id and parentId to string to avoid serialization issues
    const plainTechniques = techniques.map(tech => ({
      ...tech,
      _id: tech._id.toString(),
      parentId: tech.parentId ? tech.parentId.toString() : null,
      children: [] as any[], // Initialize children array
    }));

    // Build tree
    const map = new Map<string, any>();
    const roots: any[] = [];

    // First pass: create nodes map
    plainTechniques.forEach(item => {
      map.set(item._id, item);
    });

    // Second pass: link children
    plainTechniques.forEach(item => {
      if (item.parentId && map.has(item.parentId)) {
        map.get(item.parentId).children.push(item);
      } else {
        roots.push(item);
      }
    });

    console.log(`[getTechniqueTree] Total: ${plainTechniques.length}, Roots: ${roots.length}`);
    return roots;
  },
  ['technique-tree'],
  { revalidate: 3600, tags: ['technique-tree'] }
);

// 일반 계정의 등록/수정 요청 payload에서 허용할 필드 목록.
// TechniqueRequest 승인 시 이 필드 밖의 값(status, order, viewCount, createdBy 등)은
// 절대 라이브 데이터에 반영되지 않는다.
export const EDITABLE_TECHNIQUE_FIELDS = [
  'name',
  'aka',
  'description',
  'type',
  'primaryRole',
  'roleTags',
  'difficulty',
  'isCorePosition',
  'positionType',
  'parentId',
  'videos',
  'images',
  'thumbnailUrl',
] as const;

export function pickTechniquePayload(body: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const field of EDITABLE_TECHNIQUE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      picked[field] = body[field];
    }
  }
  return picked;
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-');  // Replace multiple - with single -
}

export async function createTechniqueFromPayload(payload: Record<string, unknown>): Promise<ITechnique> {
  await dbConnect();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = { ...payload };

  // 1. Generate Slug if not provided
  if (!body.slug) {
    const nameForSlug = body.name?.en || body.name?.ko || 'untitled';
    // Non-Latin names (e.g. Hangul-only) are stripped to '' by slugify,
    // which would fail the required `slug` field — fall back to a generated id.
    const baseSlug = slugify(nameForSlug) || `technique-${new mongoose.Types.ObjectId().toString().slice(-8)}`;
    let generatedSlug = baseSlug;

    let counter = 1;
    while (await Technique.findOne({ slug: generatedSlug })) {
      generatedSlug = `${baseSlug}-${counter}`;
      counter++;
    }
    body.slug = generatedSlug;
  }

  // 2. Handle Hierarchy
  if (body.parentId) {
    const parent = await Technique.findById(body.parentId);
    if (!parent) {
      throw new Error('Parent technique not found');
    }
    body.level = (parent.level || 1) + 1;
    body.pathSlugs = [...(parent.pathSlugs || []), parent.slug];
  } else {
    body.level = 1;
    body.pathSlugs = [];
  }

  // 3. Create Technique
  const technique = (await Technique.create({
    ...body,
    status: body.status || 'draft',
  })) as unknown as ITechnique;

  // 4. Update Parent's childrenIds
  if (body.parentId) {
    await Technique.findByIdAndUpdate(body.parentId, {
      $push: { childrenIds: technique._id },
    });
  }

  return technique;
}

export async function applyTechniqueEdit(
  id: string,
  payload: Record<string, unknown>
): Promise<ITechnique | null> {
  await dbConnect();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = { ...payload };

  const currentTechnique = await Technique.findById(id);
  if (!currentTechnique) {
    return null;
  }

  // Handle Parent Change
  if (body.parentId && body.parentId !== currentTechnique.parentId?.toString()) {
    if (currentTechnique.parentId) {
      await Technique.findByIdAndUpdate(currentTechnique.parentId, {
        $pull: { childrenIds: id },
      });
    }

    const newParent = await Technique.findById(body.parentId);
    if (newParent) {
      await Technique.findByIdAndUpdate(body.parentId, {
        $push: { childrenIds: id },
      });
      body.level = (newParent.level || 1) + 1;
      body.pathSlugs = [...(newParent.pathSlugs || []), newParent.slug];
    }
  } else if (body.parentId === null && currentTechnique.parentId) {
    await Technique.findByIdAndUpdate(currentTechnique.parentId, {
      $pull: { childrenIds: id },
    });
    body.level = 1;
    body.pathSlugs = [];
  }

  const technique = await Technique.findByIdAndUpdate(id, body, {
    new: true,
    runValidators: true,
  });

  return technique;
}
