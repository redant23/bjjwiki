// order 재번호/루트 흐름순 검증 (DB 불필요).
import assert from 'node:assert/strict';
import {
  planOrderNormalization,
  renumberSiblings,
  rootFlowRank,
  type OrderNode,
} from '../src/lib/technique-order.ts';

// 흐름순 순위: "가드 패스"는 패스, "가드 리커버리"는 가드 계열
assert.ok(rootFlowRank('테이크다운') < rootFlowRank('가드'));
assert.ok(rootFlowRank('가드') < rootFlowRank('가드 패스'));
assert.equal(rootFlowRank('가드 패스'), rootFlowRank('패스'));
assert.ok(rootFlowRank('가드 리커버리') > rootFlowRank('가드'));
assert.ok(rootFlowRank('가드 리커버리') < rootFlowRank('패스'));
assert.ok(rootFlowRank('패스') < rootFlowRank('포지션'));
assert.ok(rootFlowRank('포지션') < rootFlowRank('서브미션'));
assert.ok(rootFlowRank('서브미션') < rootFlowRank('이스케이프'));
assert.ok(rootFlowRank('이스케이프') < rootFlowRank('드릴'));
assert.equal(rootFlowRank('기타 분류'), 100);

const n = (_id: string, name: string, order: number, parentId: string | null = null): OrderNode => ({
  _id, name, order, parentId,
});

// 겹친 order(전부 0)는 이름순으로 고유하게 재번호, 이미 고유하면 변경 없음
let changes = renumberSiblings([n('a', '스프롤', 0), n('b', '드릴', 0), n('c', '트랜지션', 0)]);
assert.deepEqual([...changes.entries()].sort(), [['a', 1], ['c', 2]]);
assert.equal(renumberSiblings([n('a', 'x', 0), n('b', 'y', 1)]).size, 0);
// 명시적으로 재정렬된 항목(priority 낮음)이 같은 값의 비재정렬 형제보다 앞
changes = renumberSiblings([
  { ...n('a', '가', 0), priority: 1 },
  { ...n('b', '나', 0), priority: 0 },
]);
// b가 0번을 차지(변경 없음)하고 a가 1번으로 밀린다
assert.deepEqual([...changes.entries()], [['a', 1]]);
// 빈 구멍(0,5,9)도 연속 번호로
assert.deepEqual(
  [...renumberSiblings([n('a', 'a', 0), n('b', 'b', 5), n('c', 'c', 9)]).entries()],
  [['b', 1], ['c', 2]]
);

// 전체 정리: 루트는 흐름순, 하위 그룹은 기존 순서 유지한 채 고유화
const tree: OrderNode[] = [
  n('drill', '드릴', 0),
  n('sprawl', '스프롤', 0),
  n('armdrag', '암드래그', 0),
  n('trans', '트랜지션', 0),
  n('guard', '가드', 3),
  n('pass', '가드 패스', 2),
  n('sub', '서브미션', 1),
  n('esc', '이스케이프', 4),
  n('misc', '기타', 7),
  n('g1', '클로즈드', 0, 'guard'),
  n('g2', '오픈', 0, 'guard'),
];
const plan = planOrderNormalization(tree, { rootFlow: true });
assert.deepEqual(plan.rootOrder, [
  '스프롤', '가드', '암드래그', '가드 패스', '트랜지션', '서브미션', '이스케이프', '드릴', '기타',
]);
const finalRoot = tree
  .filter((t) => t.parentId === null)
  .map((t) => ({ name: t.name, order: plan.changes.get(t._id) ?? t.order }))
  .sort((a, b) => a.order - b.order)
  .map((t) => t.name);
assert.deepEqual(finalRoot, plan.rootOrder);
assert.equal(new Set(finalRoot).size, finalRoot.length);
// 같은 order(0)는 이름순: 오픈(g2)이 0번 유지, 클로즈드(g1)가 1번
assert.equal(plan.changes.get('g2'), undefined);
assert.equal(plan.changes.get('g1'), 1);

// rootFlow 없이는 루트도 기존 순서를 유지한 채 고유화만
const plain = planOrderNormalization(tree);
assert.deepEqual(plain.rootOrder.slice(-3), ['가드', '이스케이프', '기타']);

console.log('technique-order: all checks passed');
