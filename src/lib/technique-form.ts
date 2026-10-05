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
