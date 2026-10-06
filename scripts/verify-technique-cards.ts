// 카테고리 카드용 요약/아이콘/그룹 규칙 검증 (DB 불필요).
import assert from 'node:assert/strict';
import {
  categoryIconKey,
  CARD_GROUP_THRESHOLD,
  groupCardsByRole,
  summarizeMarkdown,
} from '../src/lib/technique-cards.ts';

// 요약: 제목은 건너뛰고 첫 본문 줄
assert.equal(summarizeMarkdown('## 개요\n두 다리로 상대를 감싸는 기본 가드입니다.\n\n## 진입\n...'), '두 다리로 상대를 감싸는 기본 가드입니다.');
assert.equal(summarizeMarkdown(''), '');
assert.equal(summarizeMarkdown(undefined), '');
assert.equal(summarizeMarkdown('## 개요\n## 진입'), '개요'); // 본문이 없으면 첫 제목
// 마크다운 문법 제거
assert.equal(summarizeMarkdown('**굵게** 그리고 [링크](/technique/x) `코드`'), '굵게 그리고 링크 코드');
assert.equal(summarizeMarkdown('> 인용문입니다'), '인용문입니다');
assert.equal(summarizeMarkdown('- 목록 첫 항목\n- 둘째'), '목록 첫 항목');
assert.equal(summarizeMarkdown('---\n본문'), '본문');
assert.equal(summarizeMarkdown('```\n# 코드\n```\n진짜 본문'), '진짜 본문');
assert.equal(summarizeMarkdown('![이미지](a.png)\n그림 아래 글'), '그림 아래 글');
// 길이: 60자 이하는 그대로, 초과는 말줄임 포함 60자
const exact = '가'.repeat(60);
assert.equal(summarizeMarkdown(exact), exact);
const long = summarizeMarkdown('가'.repeat(61));
assert.equal(Array.from(long).length, 60);
assert.ok(long.endsWith('…'));
assert.equal(Array.from(summarizeMarkdown('😀'.repeat(70))).length, 60);
assert.equal(Array.from(summarizeMarkdown('긴 문장 '.repeat(30), 20)).length <= 20, true);

// 아이콘
assert.equal(categoryIconKey('가드'), 'guard');
assert.equal(categoryIconKey('가드 패스'), 'pass');
assert.equal(categoryIconKey('서브미션'), 'submission');
assert.equal(categoryIconKey('테이크다운'), 'standing');
assert.equal(categoryIconKey('이스케이프'), 'escape');
assert.equal(categoryIconKey('드릴'), 'drill');
assert.equal(categoryIconKey('이상한 분류'), 'other');
assert.equal(categoryIconKey(undefined), 'other');

// 그룹: 임계값 미만은 묶지 않음, 이상이면 주 역할별(처음 등장 순서, 내부 순서 유지)
const mk = (n: number, role: (i: number) => string) =>
  Array.from({ length: n }, (_, i) => ({ id: i, primaryRole: role(i) }));
const few = mk(CARD_GROUP_THRESHOLD - 1, () => 'guard');
assert.deepEqual(groupCardsByRole(few), [{ role: null, items: few }]);
const many = mk(CARD_GROUP_THRESHOLD, (i) => (i % 2 === 0 ? 'sweep' : 'submission'));
const groups = groupCardsByRole(many);
assert.deepEqual(groups.map((g) => g.role), ['sweep', 'submission']);
assert.deepEqual(groups[0].items.map((x) => x.id), [0, 2, 4, 6]);
assert.equal(groups.reduce((n, g) => n + g.items.length, 0), many.length);
// 전부 같은 역할이면 묶음이 하나뿐이어도 role이 채워짐
assert.deepEqual(groupCardsByRole(mk(9, () => 'guard')).map((g) => g.role), ['guard']);

console.log('technique-cards: all checks passed');
