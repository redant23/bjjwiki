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
  assert.equal(getYoutubeEmbedUrl(url), `https://www.youtube.com/embed/${id}`);
}
assert.equal(getYoutubeVideoId('https://vimeo.com/123'), null);
assert.equal(getYoutubeEmbedUrl('https://vimeo.com/123'), 'https://vimeo.com/123');
assert.equal(getFirstYoutubeThumbnail(['', 'https://vimeo.com/1', `https://youtu.be/${id}`]), `https://img.youtube.com/vi/${id}/hqdefault.jpg`);
assert.equal(getFirstYoutubeThumbnail([]), null);

console.log('technique-form: all checks passed');
