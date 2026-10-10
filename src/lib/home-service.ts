import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';
import Combo from '@/models/Combo';
import { PUBLISHED_FILTER } from '@/lib/combo-service';
import { unstable_cache } from 'next/cache';
import { CARD_FIELDS, toTechniqueCard, type TechniqueCardData } from '@/lib/technique-card-data';
import { pickDailyIndex } from '@/lib/home-picks';

// 홈과 탐색 페이지가 같은 카드 모양을 쓴다.
export type HomeTechniqueCard = TechniqueCardData;

export interface HomeCategory {
  _id: string;
  name: string;
  href: string;
  /** 이 분류 아래 게시된 기술 수 (모든 하위 단계 포함) */
  count: number;
}

export interface HomeCombo {
  _id: string;
  number: number | null;
  chain: string[];
  saveCount: number;
}

export interface HomeData {
  today: HomeTechniqueCard | null;
  recent: HomeTechniqueCard[];
  categories: HomeCategory[];
  combos: HomeCombo[];
}

const RECENT_COUNT = 8;
const COMBO_COUNT = 4;

// dateKey를 인자로 받아 날짜별로 캐시가 나뉘고, 하루 동안 "오늘의 기술"이 고정된다.
// 트리와 같은 태그를 쓰므로 기술이 추가/수정/삭제되면 함께 갱신된다.
export const getHomeData = unstable_cache(
  async (dateKey: string): Promise<HomeData> => {
    await dbConnect();

    const roots = await Technique.find({ status: 'published', level: 1 })
      .sort({ order: 1, 'name.ko': 1 })
      .select('name slug')
      .lean();
    const rootNameBySlug = new Map<string, string>(roots.map((r) => [r.slug as string, r.name.ko as string]));

    // 카테고리별 기술 수: pathSlugs의 첫 항목(루트)으로 묶어 한 번에 센다.
    const countRows = await Technique.aggregate<{ _id: string; count: number }>([
      { $match: { status: 'published', 'pathSlugs.0': { $exists: true } } },
      { $group: { _id: { $arrayElemAt: ['$pathSlugs', 0] }, count: { $sum: 1 } } },
    ]);
    const countByRoot = new Map(countRows.map((r) => [r._id, r.count]));

    const categories: HomeCategory[] = roots.map((r) => ({
      _id: r._id.toString(),
      name: r.name.ko,
      href: `/technique/${r.slug}`,
      count: countByRoot.get(r.slug as string) ?? 0,
    }));

    // 오늘의 기술: 루트 분류를 뺀 게시 기술 중에서 날짜 시드로 하나. id 정렬로 같은 날엔 항상 같은 결과.
    const candidateIds = await Technique.find({ status: 'published', level: { $gt: 1 } })
      .sort({ _id: 1 })
      .select('_id')
      .lean();
    const index = pickDailyIndex(dateKey, candidateIds.length);
    const todayDoc =
      index >= 0 ? await Technique.findById(candidateIds[index]._id).select(CARD_FIELDS).lean() : null;

    // 최근 추가: 루트 분류는 제외하고 등록일 순
    const recentDocs = await Technique.find({ status: 'published', level: { $gt: 1 } })
      .sort({ createdAt: -1 })
      .limit(RECENT_COUNT)
      .select(CARD_FIELDS)
      .lean();

    const comboDocs = await Combo.find(PUBLISHED_FILTER)
      .sort({ saveCount: -1, createdAt: -1 })
      .limit(COMBO_COUNT)
      .populate('techniques', 'name.ko')
      .select('number techniques saveCount')
      .lean();

    return {
      today: todayDoc ? toTechniqueCard(todayDoc, rootNameBySlug) : null,
      recent: recentDocs.map((d) => toTechniqueCard(d, rootNameBySlug)),
      categories,
      combos: comboDocs.map((c) => ({
        _id: c._id.toString(),
        number: typeof c.number === 'number' ? c.number : null,
        // populate된 기술 중 삭제되어 null이 된 항목은 건너뛴다
        chain: (c.techniques as unknown as Array<{ name?: { ko?: string } } | null>)
          .map((t) => t?.name?.ko)
          .filter((n): n is string => !!n),
        saveCount: c.saveCount ?? 0,
      })),
    };
  },
  ['home-data'],
  { revalidate: 600, tags: ['technique-tree'] }
);
