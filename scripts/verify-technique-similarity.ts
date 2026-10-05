// 이름 정규화/유사 판정/슬러그 검증 (DB 불필요).
import assert from 'node:assert/strict';
import {
  diceSimilarity,
  findSimilarTechniques,
  normalizeAliasList,
  normalizeDisplayText,
  normalizeNameKey,
} from '../src/lib/technique-similarity.ts';
import { isValidSlug, slugify } from '../src/lib/technique-slug.ts';

// 정규화
assert.equal(normalizeDisplayText('  트라이앵글   초크 '), '트라이앵글 초크');
assert.equal(normalizeNameKey('Triangle Choke'), 'trianglechoke');
assert.equal(normalizeNameKey('트라이앵글-초크!'), '트라이앵글초크');
assert.equal(normalizeNameKey(undefined), '');
// 한글 자모 분리형(NFD)과 완성형(NFC)은 같은 키
assert.equal(normalizeNameKey('암바'.normalize('NFD')), normalizeNameKey('암바'));

// Dice
assert.equal(diceSimilarity('abc', 'abc'), 1);
assert.equal(diceSimilarity('', ''), 0);
assert.ok(diceSimilarity('트라이앵글초크', '트라이앵글') > 0.75);
assert.ok(diceSimilarity('암바', '초크') === 0);

const db = [
  { _id: '1', name: { ko: '트라이앵글 초크', en: 'Triangle Choke' }, aka: { ko: ['삼각 조르기'] } },
  { _id: '2', name: { ko: '암바', en: 'Armbar' }, aka: { ko: ['팔꺾기'], en: ['Juji Gatame'] } },
  { _id: '3', name: { ko: '암바 이스케이프' } },
  { _id: '4', name: { ko: '클로즈드 가드' } },
];

// 같은 이름 (공백/대소문자/기호 차이 무시)
let m = findSimilarTechniques({ name: { ko: '트라이앵글초크' } }, db);
assert.equal(m[0].candidate._id, '1');
assert.equal(m[0].reason, 'same_name');
m = findSimilarTechniques({ name: { ko: 'x', en: 'triangle-choke' } }, db);
assert.equal(m[0].reason, 'same_name');

// 별칭과 일치 (입력 이름 == 기존 별칭, 입력 별칭 == 기존 이름)
m = findSimilarTechniques({ name: { ko: '팔꺾기' } }, db);
assert.deepEqual([m[0].candidate._id, m[0].reason], ['2', 'alias']);
m = findSimilarTechniques({ name: { ko: '새 기술' }, aka: { en: ['armbar'] } }, db);
assert.deepEqual([m[0].candidate._id, m[0].reason], ['2', 'alias']);

// 유사 (임계값 이상), 짧은 이름끼리는 잡음 방지로 제외
m = findSimilarTechniques({ name: { ko: '트라이앵글 초크 홀드' } }, db);
assert.equal(m[0].candidate._id, '1');
assert.equal(m[0].reason, 'similar');
assert.deepEqual(findSimilarTechniques({ name: { ko: '암바스' } }, db), []);

// 순서: 같은 이름이 유사보다 먼저
m = findSimilarTechniques({ name: { ko: '암바' } }, db);
assert.equal(m[0].candidate._id, '2');

// 자기 자신 제외, 빈 입력은 결과 없음, limit
assert.deepEqual(findSimilarTechniques({ name: { ko: '암바' } }, db, { excludeId: '2' }), []);
assert.deepEqual(findSimilarTechniques({}, db), []);
assert.deepEqual(findSimilarTechniques({ name: { ko: '  ' } }, db), []);
assert.equal(findSimilarTechniques({ name: { ko: '암바' } }, db, { limit: 0 }).length, 0);

// 별칭 정리
assert.deepEqual(
  normalizeAliasList([' 팔꺾기 ', '팔 꺾기', '', '암바', '삼각  조르기'], ['암바']),
  ['팔꺾기', '삼각 조르기']
);

// 슬러그
assert.equal(slugify('Triangle Choke!'), 'triangle-choke');
assert.equal(slugify('half_guard  sweep'), 'half-guard-sweep');
assert.equal(slugify('트라이앵글'), '');
assert.equal(slugify(' -x- '), 'x');
assert.equal(isValidSlug('triangle-choke'), true);
assert.equal(isValidSlug('x2'), true);
for (const bad of ['', 'Triangle', 'a--b', '-a', 'a-', 'a b', '삼각', 'a_b', 'a'.repeat(81)]) {
  assert.equal(isValidSlug(bad), false, bad);
}

console.log('technique-similarity: all checks passed');
