import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';
import { CARD_FIELDS, toTechniqueCard, type TechniqueCardData } from '@/lib/technique-card-data';
import {
  BROWSE_PAGE_SIZE,
  browseSortSpec,
  buildBrowseQuery,
  type BrowseParams,
} from '@/lib/technique-browse';
import { buildSearchIndex, search } from '@/lib/search';

export interface BrowseResult {
  items: TechniqueCardData[];
  total: number;
  /** 요청한 페이지가 범위를 벗어나면 마지막 페이지로 보정된 값 */
  page: number;
  pageCount: number;
}

// 필터 조합이 다양해 캐시하지 않고 매번 조회한다 (게시된 기술 수백 개 규모, 24개씩 페이지).
export async function browseTechniques(params: BrowseParams): Promise<BrowseResult> {
  await dbConnect();
  const query = buildBrowseQuery(params);

  if (params.q) {
    // 다른 필터를 통과한 기술 중에서 이름/별칭이 맞는 것만 남긴다 (⌘K와 같은 규칙).
    const candidates = await Technique.find(query).select('_id name aka slug pathSlugs level').lean();
    const index = buildSearchIndex(
      candidates.map((t) => ({
        _id: t._id.toString(),
        name: t.name,
        aka: t.aka,
        slug: t.slug,
        pathSlugs: t.pathSlugs,
        level: t.level,
      }))
    );
    query._id = { $in: search(index, params.q).techniques.map((h) => h.technique._id) };
  }

  const total = await Technique.countDocuments(query);
  const pageCount = Math.max(1, Math.ceil(total / BROWSE_PAGE_SIZE));
  const page = Math.min(params.page, pageCount);

  let finder = Technique.find(query)
    .sort(browseSortSpec(params.sort))
    .skip((page - 1) * BROWSE_PAGE_SIZE)
    .limit(BROWSE_PAGE_SIZE)
    .select(CARD_FIELDS);
  // 이름순은 한국어 사전 순서로 정렬한다.
  if (params.sort === 'name') finder = finder.collation({ locale: 'ko' });
  const docs = await finder.lean();

  const roots = await Technique.find({ status: 'published', level: 1 }).select('name slug').lean();
  const rootNameBySlug = new Map<string, string>(roots.map((r) => [r.slug as string, r.name.ko as string]));

  return { items: docs.map((d) => toTechniqueCard(d, rootNameBySlug)), total, page, pageCount };
}
