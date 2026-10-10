// ⌘K 검색: 기술 이름·별칭, 콤보 번호/포함 기술/시전자를 정규화해 점수로 줄 세운다. DB 없이 검증할 수 있다.
import { parseComboNumberQuery } from './combo-chain.ts';

export interface SearchTechniqueInput {
  _id: string;
  name: { ko: string; en?: string };
  aka?: { ko?: string[]; en?: string[] };
  slug: string;
  pathSlugs?: string[];
  primaryRole?: string;
  level?: number;
}

export interface SearchComboInput {
  _id: string;
  /** 공개 순번. 승인 대기 중이면 null */
  number: number | null;
  techniques: string[];
  /** 시연의 시전자 이름들 (중복 제거) */
  performers?: string[];
  gearTypes?: string[];
  status?: 'pending' | 'published';
}

/**
 * 낮을수록 상위. 이름/별칭 어디에도 걸리지 않으면 결과에서 빠진다.
 * 별칭 완전 일치를 다른 기술 이름의 접두 일치보다 위에 둔다
 * ("가드 리텐션" → 별칭이 정확히 같은 '가드 리커버리'가 '가드 리텐션 힙 스위치 드릴'보다 먼저).
 */
export const TIER = {
  NAME_EXACT: 1,
  AKA_EXACT: 2,
  NAME_PREFIX: 3,
  AKA_PREFIX: 4,
  NAME_PARTIAL: 5,
  AKA_PARTIAL: 6,
} as const;

/** 초성 검색은 글자 매칭보다 항상 아래에 둔다. */
const CHOSUNG_OFFSET = 10;

const COMBO_TIER = {
  // 콤보 번호 일치("14", "#14", "14번 콤보")는 항상 최상위
  NUMBER: 0,
  PERFORMER_EXACT: 1,
  PERFORMER_PREFIX: 2,
  PERFORMER_PARTIAL: 3,
  // 시전자는 안 맞고 포함된 기술이 맞는 경우: 이 값 + 기술 점수
  VIA_TECHNIQUE: 10,
} as const;

// "X 가드" = "엑스가드"처럼 한글 이름 속 홀로 쓰인 영문 한 글자는 한글 읽기로 맞춘다.
const LETTER_READINGS: Record<string, string> = {
  a: '에이', b: '비', c: '씨', d: '디', e: '이', f: '에프', g: '지', h: '에이치', i: '아이',
  j: '제이', k: '케이', l: '엘', m: '엠', n: '엔', o: '오', p: '피', q: '큐', r: '알',
  s: '에스', t: '티', u: '유', v: '브이', w: '더블유', x: '엑스', y: '와이', z: '지',
};

const HANGUL_SYLLABLE = /[가-힣]/;
const CHOSUNG_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];
const CHOSUNG_QUERY = /^[ㄱ-ㅎ\s]+$/;
const COMPAT_JAMO = /[ㄱ-ㆎ]/g;

/** 비교용 키: 소문자화 후 문자/숫자만 남긴다 (공백·하이픈·점·슬래시·괄호 제거). */
export function normalizeSearchText(text: string | undefined | null): string {
  if (!text) return '';
  return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/** 정규화 키 + (있다면) 영문 한 글자를 한글 읽기로 바꾼 키. */
export function searchKeys(text: string | undefined | null): string[] {
  const base = normalizeSearchText(text);
  if (!base) return [];
  const raw = (text as string).normalize('NFKC').toLowerCase();
  if (!HANGUL_SYLLABLE.test(raw)) return [base];
  const read = normalizeSearchText(
    raw.replace(/(?<![a-z])[a-z](?![a-z])/g, (ch) => LETTER_READINGS[ch] ?? ch)
  );
  return read && read !== base ? [base, read] : [base];
}

/** 한글 음절을 초성으로 바꾼다. 한글이 아닌 글자는 버린다. */
export function toChosung(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0) - 0xac00;
    if (code >= 0 && code < 11172) out += CHOSUNG_LIST[Math.floor(code / 588)];
  }
  return out;
}

/** 질의가 초성(ㄱ~ㅎ)으로만 이루어졌는지. NFKC 전 원문으로 판단해야 한다. */
export function isChosungQuery(query: string): boolean {
  return CHOSUNG_QUERY.test(query) && query.replace(/\s/g, '').length > 0;
}

function matchTier(query: string, key: string, exact: number, prefix: number, partial: number): number | null {
  if (key === query) return exact;
  if (key.startsWith(query)) return prefix;
  if (key.includes(query)) return partial;
  return null;
}

function best(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

interface IndexedTechnique {
  item: SearchTechniqueInput;
  nameKeys: string[];
  akaKeys: string[];
  nameChosung: string[];
  akaChosung: string[];
  sortLength: number;
  level: number;
}

interface IndexedCombo {
  item: SearchComboInput;
  performerKeys: string[];
  performerChosung: string[];
}

export interface SearchIndex {
  techniques: IndexedTechnique[];
  byId: Map<string, IndexedTechnique>;
  combos: IndexedCombo[];
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function buildSearchIndex(
  techniques: SearchTechniqueInput[],
  combos: SearchComboInput[] = []
): SearchIndex {
  const indexed = techniques.map((item): IndexedTechnique => {
    const names = [item.name?.ko, item.name?.en].filter((v): v is string => !!v);
    const akas = [...(item.aka?.ko ?? []), ...(item.aka?.en ?? [])].filter(Boolean);
    return {
      item,
      nameKeys: unique(names.flatMap(searchKeys)),
      akaKeys: unique(akas.flatMap(searchKeys)),
      nameChosung: unique(names.map(toChosung)),
      akaChosung: unique(akas.map(toChosung)),
      sortLength: normalizeSearchText(item.name?.ko).length,
      level: item.level ?? (item.pathSlugs?.length ?? 0) + 1,
    };
  });
  return {
    techniques: indexed,
    byId: new Map(indexed.map((t) => [t.item._id, t])),
    combos: combos.map((item) => {
      const performers = item.performers ?? [];
      return {
        item,
        performerKeys: unique(performers.flatMap(searchKeys)),
        performerChosung: unique(performers.map(toChosung)),
      };
    }),
  };
}

interface PreparedQuery {
  keys: string[];
  chosung: string | null;
}

function prepareQuery(query: string): PreparedQuery | null {
  if (isChosungQuery(query)) return { keys: [], chosung: query.replace(/\s/g, '') };
  // 한글 조합 중 끝에 붙는 낱자모("플ㄹ")는 무시한다.
  const keys = searchKeys(query.replace(COMPAT_JAMO, ''));
  return keys.length ? { keys, chosung: null } : null;
}

/** 마지막 글자의 받침을 뗀다 ("플랑" → "플라"). 받침이 없으면 null. */
function dropLastFinalConsonant(query: string): string | null {
  const last = query.charCodeAt(query.length - 1) - 0xac00;
  if (last < 0 || last >= 11172 || last % 28 === 0) return null;
  return query.slice(0, -1) + String.fromCharCode(0xac00 + last - (last % 28));
}

function scoreTechnique(t: IndexedTechnique, q: PreparedQuery): number | null {
  let tier: number | null = null;
  if (q.chosung) {
    for (const key of t.nameChosung) {
      tier = best(tier, matchTier(q.chosung, key, TIER.NAME_EXACT, TIER.NAME_PREFIX, TIER.NAME_PARTIAL));
    }
    for (const key of t.akaChosung) {
      tier = best(tier, matchTier(q.chosung, key, TIER.AKA_EXACT, TIER.AKA_PREFIX, TIER.AKA_PARTIAL));
    }
    return tier === null ? null : tier + CHOSUNG_OFFSET;
  }
  for (const qk of q.keys) {
    for (const key of t.nameKeys) {
      tier = best(tier, matchTier(qk, key, TIER.NAME_EXACT, TIER.NAME_PREFIX, TIER.NAME_PARTIAL));
    }
    for (const key of t.akaKeys) {
      tier = best(tier, matchTier(qk, key, TIER.AKA_EXACT, TIER.AKA_PREFIX, TIER.AKA_PARTIAL));
    }
  }
  return tier;
}

function scoreComboPerformer(c: IndexedCombo, q: PreparedQuery): number | null {
  const { PERFORMER_EXACT, PERFORMER_PREFIX, PERFORMER_PARTIAL } = COMBO_TIER;
  let tier: number | null = null;
  if (q.chosung) {
    for (const key of c.performerChosung) {
      tier = best(tier, matchTier(q.chosung, key, PERFORMER_EXACT, PERFORMER_PREFIX, PERFORMER_PARTIAL));
    }
    return tier === null ? null : tier + CHOSUNG_OFFSET;
  }
  for (const qk of q.keys) {
    for (const key of c.performerKeys) {
      tier = best(tier, matchTier(qk, key, PERFORMER_EXACT, PERFORMER_PREFIX, PERFORMER_PARTIAL));
    }
  }
  return tier;
}

export interface TechniqueHit {
  technique: SearchTechniqueInput;
  score: number;
}

export interface ComboHit {
  combo: SearchComboInput;
  score: number;
  /** 콤보를 이루는 기술 이름 (순서대로) */
  chain: string[];
  /** 번호 질의("14번 콤보")로 걸린 경우 */
  byNumber?: boolean;
  /** 시전자 이름으로 걸렸을 때 그 이름 */
  matchedPerformer?: string;
  /** 포함된 기술로 걸렸을 때, 그 기술 이름 */
  matchedTechnique?: string;
}

export interface SearchResults {
  techniques: TechniqueHit[];
  combos: ComboHit[];
}

const EMPTY: SearchResults = { techniques: [], combos: [] };

export function search(index: SearchIndex, query: string): SearchResults {
  const trimmed = query.trim();
  const results = searchPrepared(index, prepareQuery(trimmed));
  const number = parseComboNumberQuery(trimmed);
  if (number !== null) {
    const hit = index.combos.find((c) => c.item.number === number);
    if (hit) {
      const numbered: ComboHit = {
        combo: hit.item,
        score: COMBO_TIER.NUMBER,
        chain: chainNames(index, hit.item),
        byNumber: true,
      };
      results.combos = [numbered, ...results.combos.filter((h) => h.combo._id !== hit.item._id)];
    }
  }
  if (results.techniques.length || results.combos.length) return results;
  // 한글 입력 중에는 다음 글자의 첫소리가 받침으로 먼저 붙는다("플라워"를 치는 중의 "플랑").
  // 결과가 없을 때만 받침을 떼고 다시 찾아 목록이 깜빡이지 않게 한다.
  const withoutFinal = dropLastFinalConsonant(trimmed);
  return withoutFinal ? searchPrepared(index, prepareQuery(withoutFinal)) : results;
}

function chainNames(index: SearchIndex, combo: SearchComboInput): string[] {
  return combo.techniques.map((id) => index.byId.get(id)?.item.name.ko).filter((n): n is string => !!n);
}

function searchPrepared(index: SearchIndex, q: PreparedQuery | null): SearchResults {
  if (!q) return EMPTY;

  const techScores = new Map<string, number>();
  const ranked: Array<{ t: IndexedTechnique; score: number }> = [];
  for (const t of index.techniques) {
    const score = scoreTechnique(t, q);
    if (score === null) continue;
    techScores.set(t.item._id, score);
    ranked.push({ t, score });
  }
  ranked.sort(
    (a, b) =>
      a.score - b.score ||
      a.t.sortLength - b.t.sortLength ||
      a.t.level - b.t.level ||
      a.t.item.name.ko.localeCompare(b.t.item.name.ko, 'ko')
  );

  const comboHits: ComboHit[] = [];
  for (const c of index.combos) {
    const performerScore = scoreComboPerformer(c, q);
    const chain = chainNames(index, c.item);
    if (performerScore !== null) {
      comboHits.push({
        combo: c.item,
        score: performerScore,
        chain,
        matchedPerformer: matchedPerformerName(c, q),
      });
      continue;
    }
    let bestTech: { score: number; name: string } | null = null;
    for (const id of c.item.techniques) {
      const score = techScores.get(id);
      if (score !== undefined && (!bestTech || score < bestTech.score)) {
        bestTech = { score, name: index.byId.get(id)!.item.name.ko };
      }
    }
    if (bestTech) {
      comboHits.push({
        combo: c.item,
        score: COMBO_TIER.VIA_TECHNIQUE + bestTech.score,
        chain,
        matchedTechnique: bestTech.name,
      });
    }
  }
  comboHits.sort(
    (a, b) => a.score - b.score || (a.combo.number ?? 1e9) - (b.combo.number ?? 1e9)
  );

  return {
    techniques: ranked.map(({ t, score }) => ({ technique: t.item, score })),
    combos: comboHits,
  };
}

/** 질의에 걸린 시전자 이름 원문(표시용). 정규화 키가 질의를 포함하는 첫 이름. */
function matchedPerformerName(c: IndexedCombo, q: PreparedQuery): string | undefined {
  for (const name of c.item.performers ?? []) {
    if (q.chosung) {
      if (toChosung(name).includes(q.chosung)) return name;
    } else if (searchKeys(name).some((key) => q.keys.some((qk) => key.includes(qk)))) {
      return name;
    }
  }
  return undefined;
}
