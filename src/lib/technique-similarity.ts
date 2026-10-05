// 기술 이름 정규화와 중복/유사 판정. 의존성이 없어 DB 없이 검증할 수 있다.

/** 저장용 표기 정리: 유니코드 NFC, 연속 공백을 하나로, 앞뒤 공백 제거. */
export function normalizeDisplayText(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** 비교용 키: 대소문자/공백/하이픈/기호 차이를 무시한다 (문자와 숫자만 남김). */
export function normalizeNameKey(text: string | undefined | null): string {
  if (!text) return '';
  return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function bigrams(key: string): string[] {
  const grams: string[] = [];
  for (let i = 0; i < key.length - 1; i++) grams.push(key.slice(i, i + 2));
  return grams;
}

/** 글자 2개 단위 Dice 계수 (0~1). 키 길이가 2 미만이면 정확히 같을 때만 1. */
export function diceSimilarity(a: string, b: string): number {
  if (a === b) return a ? 1 : 0;
  const ga = bigrams(a);
  const gb = bigrams(b);
  if (ga.length === 0 || gb.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const g of ga) counts.set(g, (counts.get(g) ?? 0) + 1);
  let overlap = 0;
  for (const g of gb) {
    const n = counts.get(g) ?? 0;
    if (n > 0) {
      overlap++;
      counts.set(g, n - 1);
    }
  }
  return (2 * overlap) / (ga.length + gb.length);
}

export interface SimilarityCandidate {
  _id: string;
  name: { ko: string; en?: string };
  aka?: { ko?: string[]; en?: string[] };
}

export interface SimilarityInput {
  name?: { ko?: string; en?: string };
  aka?: { ko?: string[]; en?: string[] };
}

export type SimilarReason = 'same_name' | 'alias' | 'similar';

export interface SimilarMatch<T extends SimilarityCandidate> {
  candidate: T;
  reason: SimilarReason;
  score: number;
  /** 겹친 이름/별칭 (화면 표시용) */
  matched: string;
}

const REASON_PRIORITY: Record<SimilarReason, number> = { same_name: 0, alias: 1, similar: 2 };

// 너무 짧은 이름은 글자 2개 단위 비교가 잡음이 많아 유사 판정에서 제외한다.
const MIN_SIMILAR_KEY_LENGTH = 3;

interface Keyed {
  key: string;
  label: string;
}

function keyed(values: Array<string | undefined | null>): Keyed[] {
  const seen = new Set<string>();
  const result: Keyed[] = [];
  for (const label of values) {
    const key = normalizeNameKey(label);
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push({ key, label: label as string });
    }
  }
  return result;
}

/**
 * 입력한 이름/별칭이 기존 기술과 같거나 비슷한지 찾는다.
 * same_name: 이름이 (공백/대소문자/기호 무시하고) 같음
 * alias: 한쪽의 이름이 다른 쪽의 별칭과 같음
 * similar: 이름끼리 Dice 유사도가 threshold 이상
 */
export function findSimilarTechniques<T extends SimilarityCandidate>(
  input: SimilarityInput,
  candidates: readonly T[],
  options: { excludeId?: string; limit?: number; threshold?: number } = {}
): SimilarMatch<T>[] {
  const { excludeId, limit = 5, threshold = 0.75 } = options;
  const inputNames = keyed([input.name?.ko, input.name?.en]);
  const inputAliases = keyed([...(input.aka?.ko ?? []), ...(input.aka?.en ?? [])]);
  if (inputNames.length === 0 && inputAliases.length === 0) return [];

  const matches: SimilarMatch<T>[] = [];

  for (const candidate of candidates) {
    if (excludeId && candidate._id === excludeId) continue;

    const names = keyed([candidate.name.ko, candidate.name.en]);
    const aliases = keyed([...(candidate.aka?.ko ?? []), ...(candidate.aka?.en ?? [])]);

    let best: SimilarMatch<T> | null = null;
    const consider = (reason: SimilarReason, score: number, matched: string) => {
      if (
        !best ||
        REASON_PRIORITY[reason] < REASON_PRIORITY[best.reason] ||
        (reason === best.reason && score > best.score)
      ) {
        best = { candidate, reason, score, matched };
      }
    };

    for (const mine of inputNames) {
      for (const theirs of names) {
        if (mine.key === theirs.key) consider('same_name', 1, theirs.label);
        else if (
          mine.key.length >= MIN_SIMILAR_KEY_LENGTH &&
          theirs.key.length >= MIN_SIMILAR_KEY_LENGTH
        ) {
          const score = diceSimilarity(mine.key, theirs.key);
          if (score >= threshold) consider('similar', score, theirs.label);
        }
      }
      for (const theirs of aliases) {
        if (mine.key === theirs.key) consider('alias', 1, theirs.label);
      }
    }
    for (const mine of inputAliases) {
      for (const theirs of names) {
        if (mine.key === theirs.key) consider('alias', 1, theirs.label);
      }
    }

    if (best) matches.push(best);
  }

  matches.sort(
    (a, b) =>
      REASON_PRIORITY[a.reason] - REASON_PRIORITY[b.reason] ||
      b.score - a.score ||
      a.candidate.name.ko.localeCompare(b.candidate.name.ko, 'ko')
  );
  return matches.slice(0, limit);
}

/** 별칭 목록 표기를 정리한다: 공백 정리, 빈 값/중복 제거, 기술 이름과 같은 별칭 제거. */
export function normalizeAliasList(
  aliases: readonly string[],
  ownNames: ReadonlyArray<string | undefined | null> = []
): string[] {
  const own = new Set(ownNames.map(normalizeNameKey).filter(Boolean));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of aliases) {
    const text = normalizeDisplayText(raw);
    const key = normalizeNameKey(text);
    if (key && !own.has(key) && !seen.has(key)) {
      seen.add(key);
      result.push(text);
    }
  }
  return result;
}
