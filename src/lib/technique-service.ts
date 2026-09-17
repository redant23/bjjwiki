import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Technique, { ITechnique } from '@/models/Technique';
import { unstable_cache } from 'next/cache';
import { RECENT_UPDATE_WINDOW_DAYS } from '@/lib/recent-update';

export const getTechniqueTree = unstable_cache(
  async () => {
    await dbConnect();

    // Fetch only necessary fields for the sidebar
    const techniques = await Technique.find({ status: 'published' })
      .select('_id name slug parentId pathSlugs order level contentUpdatedAt')
      .sort({ order: 1, 'name.ko': 1 })
      .lean();

    // Convert _id and parentId to string to avoid serialization issues
    const plainTechniques = techniques.map(tech => ({
      ...tech,
      _id: tech._id.toString(),
      parentId: tech.parentId ? tech.parentId.toString() : null,
      contentUpdatedAt: tech.contentUpdatedAt ? tech.contentUpdatedAt.toISOString() : null,
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

export async function createTechniqueFromPayload(
  payload: Record<string, unknown>,
  actorId?: string
): Promise<ITechnique> {
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
    contentUpdatedAt: new Date(),
    ...(actorId && { createdBy: actorId }),
  })) as unknown as ITechnique;

  // 4. Update Parent's childrenIds
  if (body.parentId) {
    await Technique.findByIdAndUpdate(body.parentId, {
      $push: { childrenIds: technique._id },
    });
  }

  return technique;
}

// name/aka/description처럼 { ko, en } 형태로 다국어를 담는 필드 목록.
// 이 필드들은 findByIdAndUpdate에 그대로 넘기면 Mongoose가 경로 전체를
// 교체해버려서, payload에 없는 언어 키(en 등)가 삭제된다. 서브키 단위로
// 점(dot) 표기 $set을 만들어 부분 필드만 병합되도록 한다.
const NESTED_MULTILANG_FIELDS = ['name', 'aka', 'description'] as const;

function buildTechniqueUpdateSet(body: Record<string, unknown>): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (
      (NESTED_MULTILANG_FIELDS as readonly string[]).includes(key) &&
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        update[`${key}.${subKey}`] = subValue;
      }
    } else {
      update[key] = value;
    }
  }
  return update;
}

// currentTechnique.get(key)를 JSON.stringify로 그대로 비교하면 Mongoose가 서브도큐먼트
// 배열(videos/images)에 자동으로 붙이는 _id 때문에 실제로는 안 바뀐 값도 "달라짐"으로
// 오판한다. 양쪽을 JSON 왕복(ObjectId 등 toJSON() 적용)시킨 뒤 _id를 재귀적으로 제거하고
// 비교한다.
function normalizeForDiff(value: unknown): unknown {
  const plain = JSON.parse(JSON.stringify(value ?? null));
  return stripIds(plain);
}

function stripIds(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripIds);
  }
  if (value && typeof value === 'object') {
    const { _id, ...rest } = value as Record<string, unknown>;
    return Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, stripIds(v)]));
  }
  return value;
}

export async function applyTechniqueEdit(
  id: string,
  payload: Record<string, unknown>,
  actorId?: string
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

  const rawUpdate = buildTechniqueUpdateSet(body);

  // 페이로드에 필드가 있어도 실제 값이 그대로면 "수정"으로 치지 않는다 —
  // 그래야 변경 없이 저장 버튼만 누른 요청이 lastEditedBy/contentUpdatedAt을
  // 잘못 갱신하지 않는다.
  const update: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawUpdate)) {
    const currentValue = currentTechnique.get(key);
    if (JSON.stringify(normalizeForDiff(currentValue)) !== JSON.stringify(normalizeForDiff(value))) {
      update[key] = value;
    }
  }

  if (Object.keys(update).length === 0) {
    return currentTechnique;
  }

  if (actorId) {
    update.lastEditedBy = actorId;
  }
  update.contentUpdatedAt = new Date();

  const technique = await Technique.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true, runValidators: true }
  );

  return technique;
}

export interface RecentlyUpdatedTechnique {
  _id: string;
  name: string;
  href: string;
}

export async function getRecentlyUpdatedTechniques(
  limit = 10
): Promise<RecentlyUpdatedTechnique[]> {
  await dbConnect();
  const since = new Date(Date.now() - RECENT_UPDATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const techniques = await Technique.find({
    status: 'published',
    contentUpdatedAt: { $gte: since },
  })
    .select('_id name slug pathSlugs contentUpdatedAt')
    .sort({ contentUpdatedAt: -1 })
    .limit(limit)
    .lean();

  return techniques.map((tech) => ({
    _id: tech._id.toString(),
    name: tech.name.ko,
    href: `/technique/${[...(tech.pathSlugs || []), tech.slug].join('/')}`,
  }));
}
