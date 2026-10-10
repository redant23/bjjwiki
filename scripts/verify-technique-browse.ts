// 필터 탐색 쿼리 해석/생성 검증 (DB 불필요).
import assert from 'node:assert/strict';
import {
  browseSortSpec,
  buildBrowseHref,
  buildBrowseQuery,
  DEFAULT_BROWSE_PARAMS,
  escapeRegex,
  hasActiveFilters,
  parseBrowseParams,
} from '../src/lib/technique-browse.ts';

const parse = (qs: string) => {
  const p = new URLSearchParams(qs);
  return parseBrowseParams((k) => p.get(k));
};

// 기본값/잘못된 값은 필터 없음으로
assert.deepEqual(parse(''), DEFAULT_BROWSE_PARAMS);
assert.deepEqual(parse('type=both&role=Drop%20Table&positionType=neutral&difficulty=9&sort=random&page=-3'), DEFAULT_BROWSE_PARAMS);
assert.equal(parse('page=abc').page, 1);
assert.equal(parse('page=999999999').page, 10000);
assert.equal(parse('page=3').page, 3);
// 정상 값
const full = parse('q=%20%ED%8A%B8%EB%9D%BC%EC%9D%B4%20&type=gi&role=guard_pass&positionType=top&difficulty=4-6&hasVideo=1&hasThumbnail=true&sort=popular&page=2');
assert.deepEqual(full, {
  q: '트라이', type: 'gi', role: 'guard_pass', positionType: 'top', difficulty: '4-6',
  hasVideo: true, hasThumbnail: true, sort: 'popular', page: 2,
});
assert.equal(parse(`q=${'a'.repeat(80)}`).q.length, 50);
assert.equal(parse('hasVideo=0').hasVideo, false);

// 정규식 이스케이프: 특수문자가 검색어에 있어도 안전하고 글자 그대로 매칭
assert.equal(escapeRegex('a.b(c)[d]*+?^$|\\'), 'a\\.b\\(c\\)\\[d\\]\\*\\+\\?\\^\\$\\|\\\\');
const re = new RegExp(escapeRegex('암바(변형)'), 'i');
assert.equal(re.test('팔 암바(변형) 2'), true);
assert.equal(re.test('암바변형'), false);
assert.equal(new RegExp(escapeRegex('ARM'), 'i').test('armbar'), true); // 대소문자 무시
assert.equal(new RegExp(escapeRegex('트라이'), 'i').test('트라이앵글 초크'), true); // 한글 부분 일치

// 쿼리 생성
assert.deepEqual(buildBrowseQuery(DEFAULT_BROWSE_PARAMS), { status: 'published', level: { $gt: 1 } });
const q = buildBrowseQuery(full) as Record<string, unknown>;
assert.deepEqual(q.type, { $in: ['gi', 'both'] }); // 기 필터는 공용 포함
assert.equal(q.primaryRole, 'guard_pass');
assert.equal(q.positionType, 'top');
assert.deepEqual(q.difficulty, { $gte: 4, $lte: 6 });
assert.deepEqual(q['videos.0'], { $exists: true });
assert.deepEqual(q.thumbnailUrl, { $nin: [null, ''] });
assert.equal(q.$or, undefined); // 검색어는 browse-service가 lib/search로 매칭한다
assert.deepEqual(buildBrowseQuery({ ...DEFAULT_BROWSE_PARAMS, type: 'nogi' }).type, { $in: ['nogi', 'both'] });

// 정렬: 동률 방지용 _id 포함
assert.deepEqual(browseSortSpec('latest'), { createdAt: -1, _id: -1 });
assert.deepEqual(browseSortSpec('name'), { 'name.ko': 1, _id: 1 });
assert.deepEqual(browseSortSpec('popular'), { viewCount: -1, createdAt: -1, _id: -1 });

// 주소: 기본값 생략, 왕복(parse∘build) 일치
assert.equal(buildBrowseHref(DEFAULT_BROWSE_PARAMS), '/techniques');
assert.equal(buildBrowseHref(DEFAULT_BROWSE_PARAMS, { page: 1 }), '/techniques');
assert.equal(buildBrowseHref(DEFAULT_BROWSE_PARAMS, { page: 3 }), '/techniques?page=3');
const href = buildBrowseHref(full);
assert.deepEqual(parse(href.split('?')[1]), full);
assert.equal(buildBrowseHref(full, { page: 1, role: null }).includes('role='), false);
assert.equal(buildBrowseHref({ ...DEFAULT_BROWSE_PARAMS, q: '암바 & 초크' }).includes('%26'), true);

// 초기화 버튼 표시 조건: 정렬/페이지만 다른 것은 필터가 아님
assert.equal(hasActiveFilters(DEFAULT_BROWSE_PARAMS), false);
assert.equal(hasActiveFilters({ ...DEFAULT_BROWSE_PARAMS, sort: 'name', page: 4 }), false);
assert.equal(hasActiveFilters({ ...DEFAULT_BROWSE_PARAMS, hasVideo: true }), true);

console.log('technique-browse: all checks passed');
