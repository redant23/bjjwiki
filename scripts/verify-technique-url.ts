// 정식 주소 판정 검증 (DB 불필요).
import assert from 'node:assert/strict';
import { canonicalTechniquePath, redirectTargetFor, safeDecodeSegment } from '../src/lib/technique-url.ts';

const xSweep = { slug: 'x-sweep', pathSlugs: ['guard', 'open', 'x'] };

assert.equal(canonicalTechniquePath(xSweep), '/technique/guard/open/x/x-sweep');
assert.equal(canonicalTechniquePath({ slug: 'guard', pathSlugs: [] }), '/technique/guard');
assert.equal(canonicalTechniquePath({ slug: 'guard' }), '/technique/guard');

// 이미 정식 주소면 리다이렉트 없음
assert.equal(redirectTargetFor(['guard', 'open', 'x', 'x-sweep'], xSweep), null);
assert.equal(redirectTargetFor(['guard'], { slug: 'guard', pathSlugs: [] }), null);

// 분류를 옮긴 뒤 옛 경로로 들어오면 새 정식 주소로
assert.equal(
  redirectTargetFor(['guard', 'open', 'x', 'x-sweep'], { slug: 'x-sweep', pathSlugs: ['sweep', 'x'] }),
  '/technique/sweep/x/x-sweep'
);
// 마지막 조각만 쓴 주소, 경로 일부가 틀린 주소, 경로가 더 긴 주소도 정식 주소로
assert.equal(redirectTargetFor(['x-sweep'], xSweep), '/technique/guard/open/x/x-sweep');
assert.equal(redirectTargetFor(['mount', 'x-sweep'], xSweep), '/technique/guard/open/x/x-sweep');
assert.equal(redirectTargetFor(['a', 'guard', 'open', 'x', 'x-sweep'], xSweep), '/technique/guard/open/x/x-sweep');
// 최상위로 올라간 경우
assert.equal(redirectTargetFor(['guard', 'open', 'x'], { slug: 'x', pathSlugs: [] }), '/technique/x');
// slug를 바꾼 경우: 옛 slug로 들어와도 새 slug 주소로 (찾는 쪽에서 이전 slug로 대상 기술을 찾아 넘긴다)
assert.equal(
  redirectTargetFor(['guard', 'old-name'], { slug: 'new-name', pathSlugs: ['guard'] }),
  '/technique/guard/new-name'
);
// 퍼센트 인코딩된 조각은 풀어서 비교
assert.equal(redirectTargetFor(['guard', 'open%2Dguard'], { slug: 'open-guard', pathSlugs: ['guard'] }), null);
assert.equal(safeDecodeSegment('%E0%A4%A'), '%E0%A4%A'); // 잘못된 인코딩은 그대로
assert.equal(safeDecodeSegment('open-guard'), 'open-guard');

console.log('technique-url: all checks passed');
