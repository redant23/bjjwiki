// 기술 폼 공용 로직 검증 (DB 불필요).
// 실행: npm run verify
import assert from 'node:assert/strict';
import {
  DESCRIPTION_TEMPLATE,
  insertDescriptionTemplate,
  normalizeRoleTag,
  normalizeRoleTags,
} from '../src/lib/technique-form.ts';
import {
  getFirstYoutubeThumbnail,
  getYoutubeEmbedUrl,
  getYoutubeThumbnailUrl,
  getYoutubeVideoId,
} from '../src/lib/youtube.ts';

// Role Tag 정규화
assert.equal(normalizeRoleTag('  Back Take '), 'back_take');
assert.equal(normalizeRoleTag('half-guard'), 'half_guard');
assert.deepEqual(normalizeRoleTags(['Backtake', 'backtake ', '', 'Framing']), ['backtake', 'framing']);

// 설명 템플릿
assert.equal(insertDescriptionTemplate(''), DESCRIPTION_TEMPLATE);
assert.equal(insertDescriptionTemplate('  \n'), DESCRIPTION_TEMPLATE);
assert.ok(insertDescriptionTemplate('기존 내용\n\n').startsWith('기존 내용\n\n## 개요'));
for (const heading of ['## 개요', '## 진입', '## 핵심 포인트', '## 흔한 실수', '## 관련 기술', '## 유사 기술']) {
  assert.ok(DESCRIPTION_TEMPLATE.includes(heading), heading);
}

// 유튜브
const id = 'dQw4w9WgXcQ';
for (const url of [
  `https://www.youtube.com/watch?v=${id}`,
  `https://www.youtube.com/watch?list=x&v=${id}&t=3`,
  `https://youtu.be/${id}?si=abc`,
  `https://www.youtube.com/shorts/${id}`,
  `https://www.youtube.com/embed/${id}`,
]) {
  assert.equal(getYoutubeVideoId(url), id, url);
  assert.equal(getYoutubeThumbnailUrl(url), `https://img.youtube.com/vi/${id}/hqdefault.jpg`);
  // 시작 시간(t=)이 있으면 ?start=초 로 보존한다.
  assert.equal(getYoutubeEmbedUrl(url), `https://www.youtube.com/embed/${id}${url.includes('&t=3') ? '?start=3' : ''}`);
}
assert.equal(getYoutubeVideoId('https://vimeo.com/123'), null);
assert.equal(getYoutubeEmbedUrl('https://vimeo.com/123'), 'https://vimeo.com/123');
assert.equal(getFirstYoutubeThumbnail(['', 'https://vimeo.com/1', `https://youtu.be/${id}`]), `https://img.youtube.com/vi/${id}/hqdefault.jpg`);
assert.equal(getFirstYoutubeThumbnail([]), null);

console.log('technique-form: all checks passed');

// ───── 제목이 있는 연결 기술 목록 ─────
import { normalizeRelatedGroups } from '../src/lib/technique-form.ts';

assert.deepEqual(normalizeRelatedGroups(undefined), []);
assert.deepEqual(normalizeRelatedGroups('x'), []);
assert.deepEqual(normalizeRelatedGroups([null, 1, 'a', {}, { title: 3, techniques: [] }]), []);

// 정상 + 제목 공백 정리
assert.deepEqual(normalizeRelatedGroups([{ title: '  이어지는   스윕 ', techniques: ['a', 'b'] }]), [
  { title: '이어지는 스윕', techniques: ['a', 'b'] },
]);
// 제목이 비었거나 기술이 없으면 버림
assert.deepEqual(normalizeRelatedGroups([{ title: '  ', techniques: ['a'] }, { title: '빈 목록', techniques: [] }]), []);
// 기술 중복/자기 자신 제외, 비문자열/빈 id 무시
assert.deepEqual(
  normalizeRelatedGroups([{ title: '방어', techniques: ['a', 'a', 'self', ' ', 5, 'b'] }], 'self'),
  [{ title: '방어', techniques: ['a', 'b'] }]
);
// 같은 제목(대소문자 무시)은 합침, 처음 쓴 제목 표기를 유지
assert.deepEqual(
  normalizeRelatedGroups([
    { title: 'Drill', techniques: ['a'] },
    { title: 'drill', techniques: ['a', 'b'] },
  ]),
  [{ title: 'Drill', techniques: ['a', 'b'] }]
);
// 자기 자신만 있던 목록은 통째로 사라짐
assert.deepEqual(normalizeRelatedGroups([{ title: '방어', techniques: ['self'] }], 'self'), []);
// 제목 30자 제한(글자 단위), 목록 10개/기술 30개 제한
assert.equal(Array.from(normalizeRelatedGroups([{ title: '가'.repeat(50), techniques: ['a'] }])[0].title).length, 30);
const manyGroups = Array.from({ length: 15 }, (_, i) => ({ title: `목록${i}`, techniques: ['a'] }));
assert.equal(normalizeRelatedGroups(manyGroups).length, 10);
const manyItems = [{ title: 't', techniques: Array.from({ length: 40 }, (_, i) => `id${i}`) }];
assert.equal(normalizeRelatedGroups(manyItems)[0].techniques.length, 30);
// 입력 순서 유지
assert.deepEqual(
  normalizeRelatedGroups([{ title: 'B', techniques: ['x'] }, { title: 'A', techniques: ['y'] }]).map((g) => g.title),
  ['B', 'A']
);

console.log('related-groups: all checks passed');
