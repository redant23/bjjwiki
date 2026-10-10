// ⌘K 검색: 기술/콤보 이름·별칭을 정규화해 점수로 줄 세운다. 의존성이 없어 DB 없이 검증할 수 있다.

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
  name: string;
  techniques: string[];
  gearType?: string;
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
  NAME_EXACT: 1,
  NAME_PREFIX: 2,
  NAME_PARTIAL: 3,
  // 콤보 이름은 안 맞고 포함된 기술이 맞는 경우: 이 값 + 기술 점수
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
  nameKeys: string[];
  nameChosung: string;
}

export interface SearchIndex {
  techniques: IndexedTechnique[];
  byId: Map<string, IndexedTechnique>;
  combos: IndexedCombo[];
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

/** 콤보 이름 맨 앞의 "[기]" 같은 말머리는 검색 키에서 뺀다. */
export function stripComboTag(name: string): string {
  return name.replace(/^\s*\[[^\]]*\]\s*/, '');
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
      const name = stripComboTag(item.name);
      return { item, nameKeys: searchKeys(name), nameChosung: toChosung(name) };
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

function scoreComboName(c: IndexedCombo, q: PreparedQuery): number | null {
  const { NAME_EXACT, NAME_PREFIX, NAME_PARTIAL } = COMBO_TIER;
  if (q.chosung) {
    const tier = matchTier(q.chosung, c.nameChosung, NAME_EXACT, NAME_PREFIX, NAME_PARTIAL);
    return tier === null ? null : tier + CHOSUNG_OFFSET;
  }
  let tier: number | null = null;
  for (const qk of q.keys) {
    for (const key of c.nameKeys) tier = best(tier, matchTier(qk, key, NAME_EXACT, NAME_PREFIX, NAME_PARTIAL));
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
  /** 콤보 이름이 아니라 포함된 기술로 걸렸을 때, 그 기술 이름 */
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
  if (results.techniques.length || results.combos.length) return results;
  // 한글 입력 중에는 다음 글자의 첫소리가 받침으로 먼저 붙는다("플라워"를 치는 중의 "플랑").
  // 결과가 없을 때만 받침을 떼고 다시 찾아 목록이 깜빡이지 않게 한다.
  const withoutFinal = dropLastFinalConsonant(trimmed);
  return withoutFinal ? searchPrepared(index, prepareQuery(withoutFinal)) : results;
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
    const nameScore = scoreComboName(c, q);
    if (nameScore !== null) {
      comboHits.push({ combo: c.item, score: nameScore });
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
        matchedTechnique: bestTech.name,
      });
    }
  }
  comboHits.sort(
    (a, b) => a.score - b.score || a.combo.name.localeCompare(b.combo.name, 'ko')
  );

  return {
    techniques: ranked.map(({ t, score }) => ({ technique: t.item, score })),
    combos: comboHits,
  };
}
