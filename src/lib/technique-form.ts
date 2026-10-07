// 기술 등록/수정 폼이 공유하는 상수와 순수 함수. 의존성이 없어 DB 없이 검증할 수 있다.

export const PRIMARY_ROLE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'position', label: '포지션' },
  { value: 'guard', label: '가드' },
  { value: 'submission', label: '서브미션' },
  { value: 'sweep', label: '스윕' },
  { value: 'escape', label: '이스케이프' },
  { value: 'guard_pass', label: '가드 패스' },
  { value: 'drill', label: '드릴' },
  { value: 'transition', label: '트랜지션' },
  { value: 'guard_recovery', label: '가드 리커버리' },
  { value: 'leg_entry', label: '레그 엔트리' },
  { value: 'control_hold', label: '컨트롤/홀드' },
  { value: 'grip', label: '그립' },
  { value: 'takedown', label: '테이크다운' },
];

export const DESCRIPTION_TEMPLATE = `## 개요
이 기술이 무엇이고 언제 쓰는지 한두 문장으로 설명합니다.

## 진입
어떤 상황/포지션에서 들어가는지 적습니다.

## 핵심 포인트
-

## 흔한 실수
-

## 관련 기술
-

## 유사 기술
-
`;

/** 기존 내용이 있으면 뒤에 빈 줄을 두고 템플릿을 붙이고, 없으면 템플릿만 반환한다. */
export function insertDescriptionTemplate(current: string): string {
  const trimmed = current.replace(/\s+$/, '');
  return trimmed ? `${trimmed}\n\n${DESCRIPTION_TEMPLATE}` : DESCRIPTION_TEMPLATE;
}

/** Role Tag 표기를 통일한다: 앞뒤 공백 제거, 소문자, 내부 공백/하이픈은 '_'. */
export function normalizeRoleTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/** 정규화 후 빈 값과 중복을 제거한다 (입력 순서 유지). */
export function normalizeRoleTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const tag = normalizeRoleTag(raw);
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
    }
  }
  return result;
}

// ───────────────────────── 제목이 있는 연결 기술 목록 ─────────────────────────
// 작성자가 "제목"(예: 이어지는 스윕, 방어법)을 짓고 그 아래에 기술들을 골라 넣는 목록.

export const RELATED_GROUP_TITLE_MAX = 30;
export const RELATED_GROUPS_MAX = 10;
export const RELATED_GROUP_ITEMS_MAX = 30;

export interface RelatedGroupInput {
  title: string;
  techniques: string[];
}

/**
 * 입력을 저장 가능한 형태로 정리한다 (잘못된 항목은 조용히 버린다).
 * - 제목은 공백을 정리하고 30자로 자르며, 제목이 비었거나 기술이 하나도 없는 목록은 버린다
 * - 같은 제목(대소문자 무시)은 하나로 합치고, 기술 중복과 자기 자신(selfId)은 제외한다
 * - 목록은 최대 10개, 목록당 기술은 최대 30개
 */
export function normalizeRelatedGroups(value: unknown, selfId?: string): RelatedGroupInput[] {
  if (!Array.isArray(value)) return [];

  const byTitle = new Map<string, RelatedGroupInput>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const { title: rawTitle, techniques } = raw as { title?: unknown; techniques?: unknown };
    if (typeof rawTitle !== 'string' || !Array.isArray(techniques)) continue;

    const title = Array.from(rawTitle.replace(/\s+/g, ' ').trim())
      .slice(0, RELATED_GROUP_TITLE_MAX)
      .join('')
      .trim();
    if (!title) continue;

    const key = title.toLowerCase();
    const group = byTitle.get(key) ?? { title, techniques: [] };
    for (const id of techniques) {
      const text = typeof id === 'string' ? id.trim() : '';
      if (text && text !== selfId && !group.techniques.includes(text)) group.techniques.push(text);
    }
    group.techniques = group.techniques.slice(0, RELATED_GROUP_ITEMS_MAX);
    byTitle.set(key, group);
  }

  return [...byTitle.values()].filter((g) => g.techniques.length > 0).slice(0, RELATED_GROUPS_MAX);
}
