// 형제 기술의 order 정리 규칙. 의존성이 없어 DB 없이 검증할 수 있다.

export interface OrderNode {
  _id: string;
  parentId: string | null;
  order: number;
  name: string;
}

// 루트 분류의 권장 순서(경기 흐름): 스탠딩 → 가드 → 패스 → 포지션 → 서브미션 → 이스케이프 → 드릴.
// 이름에 키워드가 들어 있으면 해당 순위를 받고, 위에서부터 먼저 맞는 규칙을 쓴다
// ("가드 패스"가 "가드"보다 먼저 걸려야 하므로 순서가 중요하다).
// 어디에도 맞지 않는 분류는 맨 뒤로 가되 기존 상대 순서를 유지한다.
const ROOT_FLOW_RULES: ReadonlyArray<{ keywords: readonly string[]; rank: number }> = [
  { keywords: ['패스'], rank: 2 },
  { keywords: ['리커버리'], rank: 1.2 },
  { keywords: ['암드래그', '암 드래그'], rank: 1.4 },
  { keywords: ['스윕'], rank: 1.6 },
  { keywords: ['가드'], rank: 1 },
  { keywords: ['스탠딩', '테이크다운', '스프롤', '그립', '디펜스'], rank: 0 },
  { keywords: ['포지션', '컨트롤'], rank: 3 },
  { keywords: ['레그'], rank: 3.4 },
  { keywords: ['트랜지션'], rank: 3.8 },
  { keywords: ['서브미션'], rank: 4 },
  { keywords: ['이스케이프'], rank: 5 },
  { keywords: ['드릴', '트레이닝'], rank: 6 },
];

export const ROOT_FLOW_UNMATCHED_RANK = 100;

export function rootFlowRank(name: string): number {
  const compact = name.replace(/\s+/g, '');
  for (const rule of ROOT_FLOW_RULES) {
    if (rule.keywords.some((k) => compact.includes(k.replace(/\s+/g, '')))) return rule.rank;
  }
  return ROOT_FLOW_UNMATCHED_RANK;
}

function byName(a: string, b: string): number {
  return a.localeCompare(b, 'ko');
}

/**
 * 한 부모 아래 형제들에게 0부터 고유한 order를 다시 매긴다.
 * 기존 order 순서를 유지하고, order가 같으면 priority가 낮은 쪽(명시적으로 재정렬된 항목)을 앞에,
 * 그래도 같으면 이름순. 값이 바뀌는 항목만 돌려준다.
 */
export function renumberSiblings(
  siblings: ReadonlyArray<OrderNode & { priority?: number }>
): Map<string, number> {
  const sorted = [...siblings].sort(
    (a, b) =>
      a.order - b.order ||
      (a.priority ?? 0) - (b.priority ?? 0) ||
      byName(a.name, b.name) ||
      byName(a._id, b._id)
  );
  const changes = new Map<string, number>();
  sorted.forEach((node, index) => {
    if (node.order !== index) changes.set(node._id, index);
  });
  return changes;
}

/**
 * 전체 트리의 order를 정리하는 계획. 모든 형제 그룹을 고유 번호로 재번호하고,
 * rootFlow가 켜져 있으면 루트는 경기 흐름순(같은 순위 안에서는 기존 순서)으로 배치한다.
 */
export function planOrderNormalization(
  nodes: readonly OrderNode[],
  options: { rootFlow?: boolean } = {}
): { changes: Map<string, number>; rootOrder: string[] } {
  const groups = new Map<string, OrderNode[]>();
  for (const node of nodes) {
    const key = node.parentId ?? '';
    const list = groups.get(key);
    if (list) list.push(node);
    else groups.set(key, [node]);
  }

  const changes = new Map<string, number>();
  let rootOrder: string[] = [];

  for (const [key, siblings] of groups) {
    const isRoot = key === '';
    if (isRoot && options.rootFlow) {
      const ranked = [...siblings].sort(
        (a, b) =>
          rootFlowRank(a.name) - rootFlowRank(b.name) ||
          a.order - b.order ||
          byName(a.name, b.name) ||
          byName(a._id, b._id)
      );
      rootOrder = ranked.map((n) => n.name);
      ranked.forEach((node, index) => {
        if (node.order !== index) changes.set(node._id, index);
      });
    } else {
      for (const [id, order] of renumberSiblings(siblings)) changes.set(id, order);
      if (isRoot) {
        rootOrder = [...siblings]
          .sort((a, b) => a.order - b.order || byName(a.name, b.name) || byName(a._id, b._id))
          .map((n) => n.name);
      }
    }
  }
  return { changes, rootOrder };
}
