// 기술 트리(parentId 기준)의 경로 계산용 순수 함수 모음.
// DB 없이 검증할 수 있도록 Mongoose에 의존하지 않는다.

export interface TreeNode {
  _id: string;
  slug: string;
  parentId: string | null;
}

export interface PathInfo {
  pathSlugs: string[];
  level: number;
}

function indexById(nodes: TreeNode[]): Map<string, TreeNode> {
  return new Map(nodes.map((n) => [n._id, n]));
}

function groupChildren(nodes: TreeNode[]): Map<string, TreeNode[]> {
  const children = new Map<string, TreeNode[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const list = children.get(node.parentId);
    if (list) list.push(node);
    else children.set(node.parentId, [node]);
  }
  return children;
}

/** 실제 조상 체인(루트 → 직계 부모)의 slug 배열. 순환이 있으면 null. */
export function ancestorSlugs(nodes: TreeNode[], id: string): string[] | null {
  const byId = indexById(nodes);
  const chain: string[] = [];
  const seen = new Set<string>([id]);
  let cursor = byId.get(id)?.parentId ?? null;
  while (cursor) {
    if (seen.has(cursor)) return null;
    seen.add(cursor);
    const parent = byId.get(cursor);
    if (!parent) break;
    chain.unshift(parent.slug);
    cursor = parent.parentId;
  }
  return chain;
}

/** newParentId를 nodeId의 부모로 지정하면 순환이 생기는지(자기 자신/자손을 부모로 지정) 검사한다. */
export function wouldCreateCycle(
  nodes: TreeNode[],
  nodeId: string,
  newParentId: string | null
): boolean {
  if (!newParentId) return false;
  if (newParentId === nodeId) return true;
  const byId = indexById(nodes);
  const seen = new Set<string>();
  let cursor: string | null = newParentId;
  while (cursor) {
    if (cursor === nodeId) return true;
    if (seen.has(cursor)) return true; // 이미 깨진 데이터: 안전하게 거부
    seen.add(cursor);
    cursor = byId.get(cursor)?.parentId ?? null;
  }
  return false;
}

/**
 * rootIds(생략 시 최상위 전체)의 하위 트리 전체에 대해 올바른 pathSlugs/level을 계산한다.
 * rootId 자신의 값도 현재 부모 체인 기준으로 다시 계산한다.
 */
export function computePaths(
  nodes: TreeNode[],
  rootIds?: string[]
): Map<string, PathInfo> {
  const byId = indexById(nodes);
  const children = groupChildren(nodes);
  const result = new Map<string, PathInfo>();

  const starts = (rootIds ?? nodes.filter((n) => !n.parentId || !byId.has(n.parentId)).map((n) => n._id))
    .filter((id) => byId.has(id));

  for (const startId of starts) {
    const start = byId.get(startId)!;
    const chain = ancestorSlugs(nodes, startId) ?? [];
    const startInfo: PathInfo = { pathSlugs: chain, level: chain.length + 1 };

    const queue: Array<{ node: TreeNode; info: PathInfo }> = [{ node: start, info: startInfo }];
    const visited = new Set<string>();
    while (queue.length) {
      const { node, info } = queue.shift()!;
      if (visited.has(node._id)) continue; // 순환 방어
      visited.add(node._id);
      result.set(node._id, info);
      for (const child of children.get(node._id) ?? []) {
        queue.push({
          node: child,
          info: { pathSlugs: [...info.pathSlugs, node.slug], level: info.level + 1 },
        });
      }
    }
  }
  return result;
}

export interface PathMismatch {
  _id: string;
  slug: string;
  stored: { pathSlugs: string[]; level: number };
  expected: PathInfo;
}

export function findPathMismatches(
  nodes: Array<TreeNode & { pathSlugs?: string[]; level?: number }>,
  expected: Map<string, PathInfo> = computePaths(nodes)
): PathMismatch[] {
  const mismatches: PathMismatch[] = [];
  for (const node of nodes) {
    const want = expected.get(node._id);
    if (!want) continue;
    const have = { pathSlugs: node.pathSlugs ?? [], level: node.level ?? 1 };
    if (
      have.level !== want.level ||
      have.pathSlugs.length !== want.pathSlugs.length ||
      have.pathSlugs.some((s, i) => s !== want.pathSlugs[i])
    ) {
      mismatches.push({ _id: node._id, slug: node.slug, stored: have, expected: want });
    }
  }
  return mismatches;
}

// ───────────────────────── 일괄 이동 ─────────────────────────

export type MovePlan =
  | {
      ok: true;
      /** 실제로 이동할 노드 (입력 순서 유지) */
      toMove: string[];
      skipped: Array<{ _id: string; reason: 'already_there' | 'duplicate' }>;
    }
  | { ok: false; code: 'empty' | 'not_found' | 'parent_not_found' | 'cycle'; error: string; _id?: string };

/**
 * 여러 노드를 한 부모(null이면 최상위) 아래로 옮기는 계획을 검증한다. DB는 건드리지 않는다.
 * 하나라도 문제가 있으면 전체를 거부한다 (일부만 옮겨지는 상태를 만들지 않기 위해).
 * - 존재하지 않는 노드/부모, 자기 자신이나 자손 밑으로의 이동(순환)은 거부
 * - 이미 그 부모 아래에 있거나 중복으로 선택된 노드는 건너뜀
 */
export function planMove(nodes: TreeNode[], ids: readonly string[], newParentId: string | null): MovePlan {
  if (ids.length === 0) return { ok: false, code: 'empty', error: '이동할 기술을 선택해주세요.' };
  const byId = indexById(nodes);
  if (newParentId && !byId.has(newParentId)) {
    return { ok: false, code: 'parent_not_found', error: '새 상위 기술을 찾을 수 없습니다.' };
  }

  const toMove: string[] = [];
  const skipped: Array<{ _id: string; reason: 'already_there' | 'duplicate' }> = [];
  const seen = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      skipped.push({ _id: id, reason: 'duplicate' });
      continue;
    }
    seen.add(id);
    const node = byId.get(id);
    if (!node) return { ok: false, code: 'not_found', error: '존재하지 않는 기술이 포함되어 있습니다.', _id: id };
    if (wouldCreateCycle(nodes, id, newParentId)) {
      return {
        ok: false,
        code: 'cycle',
        error: `"${node.slug}"을(를) 자기 자신 또는 자신의 하위 기술 아래로 옮길 수 없습니다.`,
        _id: id,
      };
    }
    if ((node.parentId ?? null) === newParentId) {
      skipped.push({ _id: id, reason: 'already_there' });
      continue;
    }
    toMove.push(id);
  }
  return { ok: true, toMove, skipped };
}

export interface PathChange {
  _id: string;
  slug: string;
  /** 이동 전 전체 경로 (루트 → 자기 자신 slug) */
  before: string[];
  after: string[];
}

/** 이동 후 주소(경로)가 바뀌는 모든 노드 (이동한 노드와 그 모든 자손). 이동 전/후 트리를 각각 계산해 비교한다. */
export function movedPathChanges(
  nodes: TreeNode[],
  toMove: readonly string[],
  newParentId: string | null
): PathChange[] {
  const moving = new Set(toMove);
  const after = nodes.map((n) => (moving.has(n._id) ? { ...n, parentId: newParentId } : n));
  const beforePaths = computePaths(nodes);
  const afterPaths = computePaths(after, [...toMove]);
  const changes: PathChange[] = [];
  for (const node of nodes) {
    const next = afterPaths.get(node._id);
    const prev = beforePaths.get(node._id);
    if (!next || !prev) continue;
    const beforeFull = [...prev.pathSlugs, node.slug];
    const afterFull = [...next.pathSlugs, node.slug];
    if (beforeFull.join('/') !== afterFull.join('/')) {
      changes.push({ _id: node._id, slug: node.slug, before: beforeFull, after: afterFull });
    }
  }
  return changes;
}
