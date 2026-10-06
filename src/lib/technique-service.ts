import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Technique, { ITechnique } from '@/models/Technique';
import { unstable_cache } from 'next/cache';
import { computePaths, findPathMismatches, wouldCreateCycle } from '@/lib/technique-tree';
import { normalizeRoleTags } from '@/lib/technique-form';
import {
  findSimilarTechniques,
  normalizeAliasList,
  normalizeDisplayText,
  SimilarityInput,
} from '@/lib/technique-similarity';
import { isValidSlug, slugify } from '@/lib/technique-slug';

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
// 홈 히어로의 "N개의 주짓수 기술" 카운터용. 트리와 같은 태그를 쓰므로
// 기술이 추가/삭제되어 'technique-tree'가 무효화되면 함께 갱신된다.
export const getPublishedTechniqueCount = unstable_cache(
  async () => {
    await dbConnect();
    return Technique.countDocuments({ status: 'published' });
  },
  ['published-technique-count'],
  { revalidate: 3600, tags: ['technique-tree'] }
);

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
  'sweepsFromHere',
  'submissionsFromHere',
  'escapesFromHere',
] as const;

const LINKED_TECHNIQUE_FIELDS = ['sweepsFromHere', 'submissionsFromHere', 'escapesFromHere'] as const;

export function pickTechniquePayload(body: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const field of EDITABLE_TECHNIQUE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      picked[field] = body[field];
    }
  }
  return picked;
}

/**
 * 이름/별칭 표기를 정리한다: 유니코드 정규화, 공백 정리, 별칭의 빈 값/중복/이름과 같은 값 제거.
 * body에 들어 있는 필드만 처리한다 (부분 수정 payload 지원).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeNamesInPlace(body: any, currentNames?: { ko?: string; en?: string }) {
  if (body.name && typeof body.name === 'object') {
    for (const lang of ['ko', 'en'] as const) {
      if (typeof body.name[lang] === 'string') {
        body.name[lang] = normalizeDisplayText(body.name[lang]);
      }
    }
  }
  if (body.aka && typeof body.aka === 'object') {
    const ownNames = [
      body.name?.ko ?? currentNames?.ko,
      body.name?.en ?? currentNames?.en,
    ];
    for (const lang of ['ko', 'en'] as const) {
      if (Array.isArray(body.aka[lang])) {
        body.aka[lang] = normalizeAliasList(body.aka[lang], ownNames);
      }
    }
  }
}

async function assertSlugAvailable(slug: string, selfId?: string) {
  if (!isValidSlug(slug)) {
    throw new Error('슬러그는 소문자 영문/숫자를 하이픈(-)으로 이은 형태여야 합니다. (예: triangle-choke)');
  }
  const existing = await Technique.findOne({ slug }).select('_id');
  if (existing && existing._id.toString() !== selfId) {
    throw new Error('이미 사용 중인 슬러그입니다.');
  }
}

export interface SimilarTechniqueResult {
  _id: string;
  name: string;
  href: string;
  reason: 'same_name' | 'alias' | 'similar';
  matched: string;
}

/** 이름/별칭이 기존 기술과 같거나 비슷한 기술을 찾는다 (관리자 경고용). */
export async function findSimilarTechniquesInDb(
  input: SimilarityInput,
  excludeId?: string
): Promise<SimilarTechniqueResult[]> {
  await dbConnect();
  const docs = await Technique.find().select('name aka slug pathSlugs').lean();
  const candidates = docs.map((d) => ({
    _id: d._id.toString(),
    name: { ko: d.name.ko as string, en: d.name.en as string | undefined },
    aka: { ko: (d.aka?.ko ?? []) as string[], en: (d.aka?.en ?? []) as string[] },
    href: `/technique/${[...(d.pathSlugs || []), d.slug].join('/')}`,
  }));
  return findSimilarTechniques(input, candidates, { excludeId }).map((m) => ({
    _id: m.candidate._id,
    name: m.candidate.name.ko,
    href: m.candidate.href,
    reason: m.reason,
    matched: m.matched,
  }));
}

export async function createTechniqueFromPayload(
  payload: Record<string, unknown>,
  actorId?: string
): Promise<ITechnique> {
  await dbConnect();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = { ...payload };

  normalizeNamesInPlace(body);

  // 1. Generate Slug if not provided
  if (body.slug) {
    body.slug = String(body.slug).trim().toLowerCase();
    await assertSlugAvailable(body.slug);
  } else {
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
    // 주 역할을 비워 보내면 상위 기술의 역할을 상속한다.
    if (!body.primaryRole) {
      body.primaryRole = parent.primaryRole;
    }
  } else {
    body.level = 1;
    body.pathSlugs = [];
  }

  if (!body.primaryRole) {
    throw new Error('주 역할을 선택해주세요.');
  }
  if (Array.isArray(body.roleTags)) {
    body.roleTags = normalizeRoleTags(body.roleTags);
  }

  // 새 기술은 같은 부모의 형제들 맨 뒤에 둔다 (기본값 0이 형제와 겹치지 않도록).
  if (typeof body.order !== 'number') {
    const last = await Technique.findOne({ parentId: body.parentId || null })
      .sort({ order: -1 })
      .select('order')
      .lean();
    body.order = last ? (last.order ?? 0) + 1 : 0;
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
  if (value === '' || value === undefined || value === null) {
    return null;
  }
  const plain = JSON.parse(JSON.stringify(value));
  return stripIds(plain);
}

function stripIds(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripIds);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== '_id')
        .map(([key, v]) => [key, stripIds(v)])
    );
  }
  return value;
}

async function loadTreeNodes() {
  const docs = await Technique.find().select('_id slug parentId pathSlugs level').lean();
  return docs.map((d) => ({
    _id: d._id.toString(),
    slug: d.slug as string,
    parentId: d.parentId ? d.parentId.toString() : null,
    pathSlugs: (d.pathSlugs ?? []) as string[],
    level: (d.level ?? 1) as number,
  }));
}

export interface RebuildPathsResult {
  checked: number;
  mismatched: number;
  updated: number;
  // 부모 체인이 순환이라 루트에서 닿지 않는 기술 (자동 복구 불가, 수동 확인 필요)
  unreachable: string[];
  samples: Array<{ slug: string; stored: { pathSlugs: string[]; level: number }; expected: { pathSlugs: string[]; level: number } }>;
}

/**
 * parentId 기준으로 pathSlugs/level을 다시 계산해 어긋난 문서만 갱신한다.
 * rootIds를 주면 해당 기술과 그 하위 트리만, 생략하면 전체를 대상으로 한다.
 * contentUpdatedAt/updatedAt은 건드리지 않는다 (콘텐츠 수정이 아니므로).
 */
export async function rebuildTechniquePaths(
  options: { rootIds?: string[]; dryRun?: boolean } = {}
): Promise<RebuildPathsResult> {
  await dbConnect();
  const nodes = await loadTreeNodes();
  const expected = computePaths(nodes, options.rootIds);
  const mismatches = findPathMismatches(nodes, expected);

  if (!options.dryRun && mismatches.length > 0) {
    await Technique.bulkWrite(
      mismatches.map((m) => ({
        updateOne: {
          filter: { _id: m._id },
          update: { $set: { pathSlugs: m.expected.pathSlugs, level: m.expected.level } },
        },
      })),
      { timestamps: false }
    );
  }

  return {
    checked: expected.size,
    mismatched: mismatches.length,
    updated: options.dryRun ? 0 : mismatches.length,
    unreachable: options.rootIds ? [] : nodes.filter((n) => !expected.has(n._id)).map((n) => n.slug),
    samples: mismatches.slice(0, 20).map((m) => ({ slug: m.slug, stored: m.stored, expected: m.expected })),
  };
}

export async function applyTechniqueEdit(
  id: string,
  payload: Record<string, unknown>,
  actorId?: string,
  // silent: 이름/태그 정리 같은 경미한 수정. contentUpdatedAt을 갱신하지 않아
  // 사이드바 노란 점과 홈 공지에 "최근 업데이트"로 올라가지 않는다.
  options: { silent?: boolean } = {}
): Promise<ITechnique | null> {
  await dbConnect();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = { ...payload };

  const currentTechnique = await Technique.findById(id);
  if (!currentTechnique) {
    return null;
  }

  normalizeNamesInPlace(body, {
    ko: currentTechnique.get('name.ko'),
    en: currentTechnique.get('name.en'),
  });
  if ('slug' in body) {
    body.slug = String(body.slug ?? '').trim().toLowerCase();
    if (body.slug !== currentTechnique.slug) {
      await assertSlugAvailable(body.slug, id);
    }
  }
  if ('primaryRole' in body && !body.primaryRole) {
    throw new Error('주 역할은 비울 수 없습니다.');
  }
  if (Array.isArray(body.roleTags)) {
    body.roleTags = normalizeRoleTags(body.roleTags);
  }
  // 자기 자신을 연결 기술로 지정할 수 없다.
  for (const field of LINKED_TECHNIQUE_FIELDS) {
    if (Array.isArray(body[field])) {
      body[field] = body[field].filter((linkedId: unknown) => String(linkedId) !== id);
    }
  }

  // Handle Parent Change
  // undefined = 변경 없음, null/'' = 최상위로 이동. 검증을 모두 마친 뒤에만 childrenIds를 수정한다.
  const oldParentId = currentTechnique.parentId?.toString() ?? null;
  const requestedParentId: string | null | undefined =
    body.parentId === undefined ? undefined : body.parentId || null;
  const parentChanged = requestedParentId !== undefined && requestedParentId !== oldParentId;

  if (requestedParentId !== undefined) {
    body.parentId = requestedParentId;
  }

  if (parentChanged) {
    if (requestedParentId) {
      const newParent = await Technique.findById(requestedParentId).select('_id');
      if (!newParent) {
        throw new Error('Parent technique not found');
      }
      if (wouldCreateCycle(await loadTreeNodes(), id, requestedParentId)) {
        throw new Error('Cannot set the technique itself or its descendant as its parent');
      }
    }

    if (oldParentId) {
      await Technique.findByIdAndUpdate(oldParentId, { $pull: { childrenIds: id } });
    }
    if (requestedParentId) {
      await Technique.findByIdAndUpdate(requestedParentId, { $addToSet: { childrenIds: id } });
    }
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
  if (!options.silent) {
    update.contentUpdatedAt = new Date();
  }

  const technique = await Technique.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true, runValidators: true }
  );

  // 부모나 slug가 바뀌면 이 기술뿐 아니라 모든 하위 기술의 pathSlugs/level이 달라진다.
  if (parentChanged || 'slug' in update) {
    await rebuildTechniquePaths({ rootIds: [id] });
    return Technique.findById(id);
  }

  return technique;
}

// 기존 기술에 쓰인 Role Tag와 사용 횟수 (자동완성/통제용). 트리와 같은 태그로 무효화된다.
export const getRoleTagCounts = unstable_cache(
  async () => {
    await dbConnect();
    const rows = await Technique.aggregate<{ _id: string; count: number }>([
      { $unwind: '$roleTags' },
      { $group: { _id: '$roleTags', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 300 },
    ]);
    return rows.map((r) => ({ tag: r._id, count: r.count }));
  },
  ['role-tag-counts'],
  { revalidate: 3600, tags: ['technique-tree'] }
);
