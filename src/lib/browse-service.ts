import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';
import { CARD_FIELDS, toTechniqueCard, type TechniqueCardData } from '@/lib/technique-card-data';
import {
  BROWSE_PAGE_SIZE,
  browseSortSpec,
  buildBrowseQuery,
  type BrowseParams,
} from '@/lib/technique-browse';

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
