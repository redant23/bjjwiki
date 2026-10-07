// 필터 탐색 페이지(/techniques)의 쿼리 해석/생성. 의존성이 없어 DB 없이 검증할 수 있다.

export const BROWSE_PAGE_SIZE = 24;
export const BROWSE_Q_MAX = 50;

export type BrowseSort = 'latest' | 'name' | 'popular';
export type BrowseType = 'gi' | 'nogi';
export type BrowsePositionType = 'top' | 'bottom';

/** 난이도 구간 (입문/중급/상급). 주소에는 "1-3" 같은 값으로 담는다. */
export const DIFFICULTY_BANDS = {
  '1-3': { min: 1, max: 3, label: '입문 (1~3)' },
  '4-6': { min: 4, max: 6, label: '중급 (4~6)' },
  '7-10': { min: 7, max: 10, label: '상급 (7~10)' },
} as const;
export type DifficultyBand = keyof typeof DIFFICULTY_BANDS;

export interface BrowseParams {
  q: string;
  type: BrowseType | null;
  role: string | null;
  positionType: BrowsePositionType | null;
  difficulty: DifficultyBand | null;
  hasVideo: boolean;
  hasThumbnail: boolean;
  sort: BrowseSort;
  page: number;
}

export const DEFAULT_BROWSE_PARAMS: BrowseParams = {
  q: '',
  type: null,
  role: null,
  positionType: null,
  difficulty: null,
  hasVideo: false,
  hasThumbnail: false,
  sort: 'latest',
  page: 1,
};

const SORTS: readonly BrowseSort[] = ['latest', 'name', 'popular'];

/** 주소의 값을 안전하게 정규화한다. 알 수 없는 값은 기본값(필터 없음)으로 되돌린다. */
export function parseBrowseParams(get: (key: string) => string | null | undefined): BrowseParams {
  const str = (key: string) => (get(key) ?? '').trim();
  const flag = (key: string) => ['1', 'true'].includes(str(key));

  const type = str('type');
  const positionType = str('positionType');
  const difficulty = str('difficulty');
  const sort = str('sort');
  const role = str('role');
  const page = Number.parseInt(str('page'), 10);

  return {
    q: Array.from(str('q')).slice(0, BROWSE_Q_MAX).join(''),
    type: type === 'gi' || type === 'nogi' ? type : null,
    role: /^[a-z_]{1,30}$/.test(role) ? role : null,
    positionType: positionType === 'top' || positionType === 'bottom' ? positionType : null,
    difficulty: difficulty in DIFFICULTY_BANDS ? (difficulty as DifficultyBand) : null,
    hasVideo: flag('hasVideo'),
    hasThumbnail: flag('hasThumbnail'),
    sort: (SORTS as readonly string[]).includes(sort) ? (sort as BrowseSort) : 'latest',
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, 10000) : 1,
  };
}

export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** MongoDB 필터. 게시된 기술만, 루트 분류(카테고리)는 제외한다. */
export function buildBrowseQuery(p: BrowseParams): Record<string, unknown> {
  const query: Record<string, unknown> = { status: 'published', level: { $gt: 1 } };

  if (p.q) {
    const pattern = new RegExp(escapeRegex(p.q), 'i');
    query.$or = [{ 'name.ko': pattern }, { 'name.en': pattern }, { 'aka.ko': pattern }, { 'aka.en': pattern }];
  }
  // 기/노기 필터에는 "공용"도 포함한다 (도복을 입고도, 안 입고도 할 수 있는 기술이므로).
  if (p.type) query.type = { $in: [p.type, 'both'] };
  if (p.role) query.primaryRole = p.role;
  if (p.positionType) query.positionType = p.positionType;
  if (p.difficulty) {
    const band = DIFFICULTY_BANDS[p.difficulty];
    query.difficulty = { $gte: band.min, $lte: band.max };
  }
  if (p.hasVideo) query['videos.0'] = { $exists: true };
  if (p.hasThumbnail) query.thumbnailUrl = { $nin: [null, ''] };

  return query;
}

/** 정렬. 같은 값일 때 순서가 흔들리지 않도록 마지막에 _id를 붙인다. */
export function browseSortSpec(sort: BrowseSort): Record<string, 1 | -1> {
  switch (sort) {
    case 'name':
      return { 'name.ko': 1, _id: 1 };
    case 'popular':
      return { viewCount: -1, createdAt: -1, _id: -1 };
    default:
      return { createdAt: -1, _id: -1 };
  }
}

/** 현재 필터에서 일부만 바꾼 주소. 기본값은 생략해 주소를 짧게 유지한다. */
export function buildBrowseHref(p: BrowseParams, overrides: Partial<BrowseParams> = {}): string {
  const v = { ...p, ...overrides };
  const params = new URLSearchParams();
  if (v.q) params.set('q', v.q);
  if (v.type) params.set('type', v.type);
  if (v.role) params.set('role', v.role);
  if (v.positionType) params.set('positionType', v.positionType);
  if (v.difficulty) params.set('difficulty', v.difficulty);
  if (v.hasVideo) params.set('hasVideo', '1');
  if (v.hasThumbnail) params.set('hasThumbnail', '1');
  if (v.sort !== 'latest') params.set('sort', v.sort);
  if (v.page > 1) params.set('page', String(v.page));
  const qs = params.toString();
  return qs ? `/techniques?${qs}` : '/techniques';
}

/** 필터(검색어, 정렬 제외)가 하나라도 걸려 있는지. "초기화" 버튼 표시용. */
export function hasActiveFilters(p: BrowseParams): boolean {
  return !!(p.q || p.type || p.role || p.positionType || p.difficulty || p.hasVideo || p.hasThumbnail);
}
