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

// ───── 일괄 이동 ─────
import { movedPathChanges, planMove } from '../src/lib/technique-tree.ts';

// guard > open > x > x-sweep, guard > closed, mount, sub
const mv: TreeNode[] = [
  n('guard', null),
  n('open', 'guard'),
  n('x', 'open'),
  n('x-sweep', 'x'),
  n('closed', 'guard'),
  n('mount', null),
  n('sub', null),
];

// 정상: 여러 개를 한 부모 아래로, 입력 순서 유지
let plan = planMove(mv, ['closed', 'open'], 'mount');
assert.deepEqual(plan, { ok: true, toMove: ['closed', 'open'], skipped: [] });

// 이미 그 부모 아래 / 중복 선택은 건너뜀
plan = planMove(mv, ['open', 'closed', 'open', 'sub'], 'guard');
assert.deepEqual(plan, {
  ok: true,
  toMove: ['sub'],
  skipped: [
    { _id: 'open', reason: 'already_there' },
    { _id: 'closed', reason: 'already_there' },
    { _id: 'open', reason: 'duplicate' },
  ],
});

// 최상위로 이동: 이미 루트인 것은 건너뜀
plan = planMove(mv, ['x', 'mount'], null);
assert.deepEqual(plan, { ok: true, toMove: ['x'], skipped: [{ _id: 'mount', reason: 'already_there' }] });

// 거부: 자기 자신/자손 밑, 선택 중 하나라도 순환이면 전체 거부
for (const [ids, parent] of [[['guard'], 'x-sweep'], [['open'], 'open'], [['mount', 'guard'], 'x']] as const) {
  const r = planMove(mv, ids, parent);
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.code, 'cycle');
}
// 거부: 빈 선택, 없는 노드, 없는 부모
assert.equal(planMove(mv, [], 'mount').ok, false);
assert.equal(!planMove(mv, ['nope'], 'mount').ok && (planMove(mv, ['nope'], 'mount') as { code: string }).code, 'not_found');
assert.equal((planMove(mv, ['open'], 'nope') as { code: string }).code, 'parent_not_found');

// 경로 변화: open(+자손)을 mount 아래로 → open, x, x-sweep 주소가 바뀐다. closed/guard는 그대로
const changes = movedPathChanges(mv, ['open'], 'mount');
assert.deepEqual(changes.map((c) => c._id).sort(), ['open', 'x', 'x-sweep']);
const xs = changes.find((c) => c._id === 'x-sweep')!;
assert.deepEqual(xs.before, ['guard', 'open', 'x', 'x-sweep']);
assert.deepEqual(xs.after, ['mount', 'open', 'x', 'x-sweep']);
// 여러 개 이동: 각각의 하위 트리 포함
assert.deepEqual(
  movedPathChanges(mv, ['open', 'closed'], 'sub').map((c) => c._id).sort(),
  ['closed', 'open', 'x', 'x-sweep']
);
// 최상위로 올리면 level이 바뀌고 주소에서 부모 경로가 빠진다
assert.deepEqual(movedPathChanges(mv, ['x'], null).find((c) => c._id === 'x')!.after, ['x']);
// 같은 부모 안에서는 주소가 바뀌지 않는다
assert.deepEqual(movedPathChanges(mv, [], 'mount'), []);

console.log('technique-tree move: all checks passed');
