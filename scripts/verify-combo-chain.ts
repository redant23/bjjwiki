// 콤보 체인의 "다음 기술" 계산 검증 (DB 불필요).
import assert from 'node:assert/strict';
import { followingInChains } from '../src/lib/combo-chain.ts';

// 기본: A 다음에 오는 기술
assert.deepEqual(followingInChains([['A', 'B', 'C']], 'A'), [{ _id: 'B', count: 1 }]);
// 바로 다음만(B 다음은 C, A 다음의 C는 아님)
assert.deepEqual(followingInChains([['A', 'B', 'C']], 'B'), [{ _id: 'C', count: 1 }]);
// 마지막 기술은 이어지는 것이 없음, 포함되지 않은 콤보는 무시
assert.deepEqual(followingInChains([['A', 'B', 'C']], 'C'), []);
assert.deepEqual(followingInChains([['A', 'B']], 'Z'), []);
assert.deepEqual(followingInChains([], 'A'), []);

// 여러 콤보: 많이 이어진 순
const chains = [
  ['A', 'X'],
  ['A', 'Y'],
  ['B', 'A', 'Y'],
  ['A', 'Z'],
];
assert.deepEqual(followingInChains(chains, 'A'), [
  { _id: 'Y', count: 2 },
  { _id: 'X', count: 1 },
  { _id: 'Z', count: 1 },
]);

// 동률은 먼저 발견된 순서 유지
assert.deepEqual(followingInChains([['A', 'Q'], ['A', 'P']], 'A').map((f) => f._id), ['Q', 'P']);

// 한 콤보에 같은 기술이 여러 번 나와도 그 콤보는 한 번만 셈 (A→Y, A→Y)
assert.deepEqual(followingInChains([['A', 'Y', 'A', 'Y']], 'A'), [{ _id: 'Y', count: 1 }]);
// 한 콤보에서 서로 다른 다음 기술 두 개 (A→X, A→Y)
assert.deepEqual(
  followingInChains([['A', 'X', 'A', 'Y']], 'A').map((f) => f._id).sort(),
  ['X', 'Y']
);
// 바로 다음이 자기 자신이면 건너뜀
assert.deepEqual(followingInChains([['A', 'A', 'B']], 'A'), [{ _id: 'B', count: 1 }]);

// limit
const many = Array.from({ length: 20 }, (_, i) => ['A', `T${i}`]);
assert.equal(followingInChains(many, 'A').length, 12);
assert.equal(followingInChains(many, 'A', 5).length, 5);
assert.equal(followingInChains(many, 'A', 0).length, 0);

console.log('combo-chain: all checks passed');
