// 홈의 "오늘의 기술" 선택 규칙. 의존성이 없어 DB 없이 검증할 수 있다.

/** 한국 시간(UTC+9) 기준 날짜 키 (YYYY-MM-DD). 하루 동안 같은 기술을 보여주는 시드로 쓴다. */
export function kstDateKey(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** FNV-1a 32비트 해시. 같은 문자열이면 항상 같은 값. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** 시드(날짜 키)로 0 이상 count 미만의 인덱스를 결정적으로 고른다. count가 0 이하이면 -1. */
export function pickDailyIndex(seed: string, count: number): number {
  if (!Number.isFinite(count) || count <= 0) return -1;
  return fnv1a(seed) % Math.floor(count);
}
