// 카테고리 페이지의 자식 카드용 순수 함수. 의존성이 없어 DB 없이 검증할 수 있다.

/** 자식이 이 개수 이상이면 주 역할별로 묶어서 보여준다. */
export const CARD_GROUP_THRESHOLD = 8;

/** 마크다운 문법을 걷어낸 한 줄 텍스트. */
function stripInlineMarkdown(line: string): string {
  return line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // 이미지
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 링크는 글자만
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__|\*|_|~~)/g, '')
    .replace(/^\s*(>+|[-*+]|\d+[.)])\s+/, '') // 인용/목록 기호
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 설명의 "첫 줄" 요약. 제목(#)만 있는 줄은 건너뛰고 첫 본문 줄을 쓴다
 * (설명 템플릿이 "## 개요"로 시작하므로). 본문이 없으면 첫 제목 글자를 쓴다.
 * max자를 넘으면 말줄임표를 붙여 전체 길이가 max를 넘지 않게 한다.
 */
export function summarizeMarkdown(markdown: string | undefined | null, max = 60): string {
  if (!markdown) return '';
  let firstHeading = '';
  let inFence = false;
  let picked = '';

  for (const raw of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const heading = raw.match(/^ {0,3}#{1,6}\s+(.*\S)\s*$/);
    if (heading) {
      if (!firstHeading) firstHeading = stripInlineMarkdown(heading[1]);
      continue;
    }
    const text = stripInlineMarkdown(raw);
    // "---" 같은 구분선, 빈 줄은 건너뜀
    if (text && !/^[-*_=\s]+$/.test(text)) {
      picked = text;
      break;
    }
  }

  const text = picked || firstHeading;
  const chars = Array.from(text); // 한글/이모지를 글자 단위로 센다
  return chars.length > max ? `${chars.slice(0, max - 1).join('').trimEnd()}…` : text;
}

export type CategoryIconKey =
  | 'standing'
  | 'guard'
  | 'pass'
  | 'position'
  | 'submission'
  | 'escape'
  | 'drill'
  | 'transition'
  | 'sweep'
  | 'other';

// 위에서부터 먼저 맞는 규칙을 쓴다 ("가드 패스"는 가드보다 패스가 먼저 걸려야 한다).
const ICON_RULES: ReadonlyArray<{ key: CategoryIconKey; keywords: readonly string[] }> = [
  { key: 'pass', keywords: ['패스'] },
  { key: 'sweep', keywords: ['스윕'] },
  { key: 'guard', keywords: ['가드', '암드래그'] },
  { key: 'standing', keywords: ['스탠딩', '테이크다운', '스프롤', '그립'] },
  { key: 'position', keywords: ['포지션', '컨트롤', '레그'] },
  { key: 'transition', keywords: ['트랜지션'] },
  { key: 'submission', keywords: ['서브미션'] },
  { key: 'escape', keywords: ['이스케이프'] },
  { key: 'drill', keywords: ['드릴', '트레이닝'] },
];

/** 루트 분류 이름으로 아이콘 종류를 고른다. 어디에도 안 맞으면 'other'. */
export function categoryIconKey(rootName: string | undefined | null): CategoryIconKey {
  const compact = (rootName ?? '').replace(/\s+/g, '');
  for (const rule of ICON_RULES) {
    if (rule.keywords.some((k) => compact.includes(k))) return rule.key;
  }
  return 'other';
}

export interface CardGroup<T> {
  /** 묶음 기준 값 (주 역할). 묶지 않을 때는 null */
  role: string | null;
  items: T[];
}

/**
 * 자식이 threshold개 이상이면 주 역할별로 묶는다. 묶음은 처음 등장한 순서를 따르고
 * 묶음 안의 순서(=order)도 그대로 유지한다. 미만이면 하나의 묶음(role=null)으로 돌려준다.
 */
export function groupCardsByRole<T extends { primaryRole: string }>(
  items: readonly T[],
  threshold = CARD_GROUP_THRESHOLD
): CardGroup<T>[] {
  if (items.length < threshold) return [{ role: null, items: [...items] }];
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const list = groups.get(item.primaryRole);
    if (list) list.push(item);
    else groups.set(item.primaryRole, [item]);
  }
  return [...groups].map(([role, list]) => ({ role, items: list }));
}
