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

export const TYPE_LABELS: Record<string, string> = {
  gi: '기 (도복)',
  nogi: '노기',
  both: '기/노기 공용',
};

export const ROLE_LABELS: Record<string, string> = {
  position: '포지션',
  guard: '가드',
  submission: '서브미션',
  sweep: '스윕',
  escape: '이스케이프',
  guard_pass: '가드 패스',
  drill: '드릴',
  transition: '트랜지션',
  guard_recovery: '가드 리커버리',
  leg_entry: '레그 엔트리',
  control_hold: '컨트롤/홀드',
  grip: '그립',
  takedown: '테이크다운',
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

/** 필드 값이 비어있는지(=미입력) 판단한다. 등록 요청에서 실제로 입력된
 * 항목만 추려낼 때 사용한다. */
export function isEmptyFieldValue(key: string, value: unknown): boolean {
  if (value === undefined || value === null) return true;

  if (key === 'name' || key === 'description') {
    const v = value as { ko?: string; en?: string };
    return !v?.ko?.trim() && !v?.en?.trim();
  }
  if (key === 'aka') {
    const v = value as { ko?: string[]; en?: string[] };
    return !v?.ko?.length && !v?.en?.length;
  }
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'boolean' || typeof value === 'number') return false;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

/**
 * 등록 요청의 payload에서 실제로 입력된(비어있지 않은) 필드만 추려낸다.
 */
export function getEnteredFields(
  payload: Record<string, unknown>
): Array<{ key: string; before: undefined; after: unknown }> {
  return Object.entries(payload)
    .filter(([key, value]) => !isEmptyFieldValue(key, value))
    .map(([key, after]) => ({ key, before: undefined, after }));
}

/** 필드별로 사람이 읽기 좋은 텍스트로 변환한다 (상세 diff 뷰용, 잘라내지 않음). */
export function formatFieldValue(key: string, value: unknown): string {
  if (isEmptyFieldValue(key, value)) return '(없음)';

  if (key === 'name' || key === 'description') {
    const v = value as { ko?: string; en?: string };
    return v.en ? `${v.ko || ''} (${v.en})` : v.ko || '';
  }
  if (key === 'aka') {
    const v = value as { ko?: string[]; en?: string[] };
    return [...(v.ko || []), ...(v.en || [])].join(', ');
  }
  if (key === 'type') return TYPE_LABELS[value as string] || String(value);
  if (key === 'primaryRole' || key === 'positionType') {
    return ROLE_LABELS[value as string] || String(value);
  }
  if (key === 'roleTags' && Array.isArray(value)) return value.join(', ');
  if (key === 'isCorePosition') return value ? '예' : '아니오';
  if ((key === 'videos' || key === 'images') && Array.isArray(value)) {
    return (value as Array<{ url: string }>).map((v) => v.url).join('\n');
  }
  if (key === 'parentId') return value ? String(value) : '(최상위 카테고리)';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}
