export const FIELD_LABELS: Record<string, string> = {
  name: '기술명',
  aka: '별칭',
  description: '설명',
  type: '유형',
  primaryRole: '주 역할',
  roleTags: 'Role Tags',
  difficulty: '난이도',
  isCorePosition: '핵심 포지션 여부',
  positionType: '포지션 타입',
  parentId: '상위 기술',
  videos: '영상',
  images: '이미지',
  thumbnailUrl: '썸네일',
};

export function stringifyValue(value: unknown): string {
  if (value === undefined || value === null) return '(없음)';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function truncate(text: string, max = 80): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** 목록/모달처럼 좁은 공간에 넣을 한 줄짜리 값 요약. */
export function summarizeValue(key: string, value: unknown): string {
  if (value === undefined || value === null) return '(없음)';

  if (key === 'name' || key === 'aka' || key === 'description') {
    const v = value as { ko?: string; en?: string };
    if (!v || (!v.ko && !v.en)) return '(없음)';
    return truncate(v.en ? `${v.ko || ''} (${v.en})` : v.ko || '');
  }

  if (key === 'roleTags' && Array.isArray(value)) {
    return value.length > 0 ? truncate(value.join(', ')) : '(없음)';
  }

  if (key === 'videos' && Array.isArray(value)) {
    return value.length > 0 ? `${value.length}개` : '(없음)';
  }

  if (key === 'isCorePosition') {
    return value ? '예' : '아니오';
  }

  if (typeof value === 'string') return truncate(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  return truncate(JSON.stringify(value));
}

/**
 * 수정 요청의 payload(폼 스냅샷 전체)와 현재 기술 데이터를 비교해
 * 실제로 값이 달라진 필드만 추려낸다.
 */
export function getChangedFields(
  payload: Record<string, unknown>,
  target: Record<string, unknown> | null | undefined
): Array<{ key: string; before: unknown; after: unknown }> {
  return Object.entries(payload)
    .filter(([key, after]) => {
      const before = target ? target[key] : undefined;
      return JSON.stringify(before ?? null) !== JSON.stringify(after ?? null);
    })
    .map(([key, after]) => ({ key, before: target ? target[key] : undefined, after }));
}
