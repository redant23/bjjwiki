// 기술 트리 경로 계산 로직 검증 (DB 불필요).
// 실행: npm run verify:tree
import assert from 'node:assert/strict';
import {
  ancestorSlugs,
  computePaths,
  findPathMismatches,
  wouldCreateCycle,
  type TreeNode,
} from '../src/lib/technique-tree.ts';

const n = (_id: string, parentId: string | null): TreeNode => ({ _id, slug: _id, parentId });

// guard > open > x > x-sweep,  mount(별도 루트)
const base: TreeNode[] = [
  n('guard', null),
  n('open', 'guard'),
  n('x', 'open'),
  n('x-sweep', 'x'),
  n('mount', null),
];

// 1. 기본 경로/레벨
let paths = computePaths(base);
assert.deepEqual(paths.get('x-sweep'), { pathSlugs: ['guard', 'open', 'x'], level: 4 });
assert.deepEqual(paths.get('mount'), { pathSlugs: [], level: 1 });

// 2. 상위 기술 이동 시 하위 전체가 따라와야 한다 (P0-1 핵심 시나리오): open을 mount 아래로
const moved = base.map((t) => (t._id === 'open' ? { ...t, parentId: 'mount' } : t));
paths = computePaths(moved, ['open']);
assert.deepEqual(paths.get('open'), { pathSlugs: ['mount'], level: 2 });
assert.deepEqual(paths.get('x'), { pathSlugs: ['mount', 'open'], level: 3 });
assert.deepEqual(paths.get('x-sweep'), { pathSlugs: ['mount', 'open', 'x'], level: 4 });
assert.equal(paths.has('guard'), false, '범위 밖 노드는 계산하지 않는다');

// 3. 이동 전 저장값(stale)과의 불일치 검출
const stale = moved.map((t) => ({
  ...t,
  ...(computePaths(base).get(t._id) ?? { pathSlugs: [], level: 1 }),
}));
const mismatches = findPathMismatches(stale).map((m) => m._id).sort();
assert.deepEqual(mismatches, ['open', 'x', 'x-sweep']);

// 4. 복구 후에는 불일치 0
const fixed = moved.map((t) => ({ ...t, ...computePaths(moved).get(t._id)! }));
assert.equal(findPathMismatches(fixed).length, 0);

// 5. 순환 참조 방지
assert.equal(wouldCreateCycle(base, 'guard', 'x-sweep'), true, '자손을 부모로');
assert.equal(wouldCreateCycle(base, 'guard', 'guard'), true, '자기 자신을 부모로');
assert.equal(wouldCreateCycle(base, 'x', 'mount'), false);
assert.equal(wouldCreateCycle(base, 'x', null), false);

// 6. 이미 깨진 순환 데이터에서도 무한루프 없이 종료
const cyclic = [n('a', 'b'), n('b', 'a'), n('root', null)];
assert.equal(ancestorSlugs(cyclic, 'a'), null);
assert.equal(computePaths(cyclic).has('a'), false, '루트에서 닿지 않는 순환 노드는 unreachable');

console.log('technique-tree: all checks passed');
