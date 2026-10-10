// 콤보 v2 순수 로직 검증 (DB 불필요): 기술 순서 키, 번호 질의, 시연 중복 키/검증, 카드 요약.
import assert from 'node:assert/strict';
import {
  buildChainKey,
  comboShareText,
  demoVideoKey,
  normalizePerformer,
  parseComboNumberParam,
  parseComboNumberQuery,
  summarizeDemos,
  validateDemoInput,
} from '../src/lib/combo-chain.ts';
import { getYoutubeEmbedUrl } from '../src/lib/youtube.ts';

// 기술 순서: 순서가 다르면 다른 콤보, 앞부분만 같아도 다른 콤보, 같은 기술 반복 허용
assert.equal(buildChainKey(['a', 'b']), 'a>b');
assert.notEqual(buildChainKey(['a', 'b']), buildChainKey(['b', 'a']));
assert.notEqual(buildChainKey(['a', 'b']), buildChainKey(['a', 'b', 'c']));
assert.equal(buildChainKey(['a', 'b', 'a']), 'a>b>a');

// 번호 질의
for (const q of ['14', '#14', '14번', '14번 콤보', '#14번 콤보', ' 14 번 콤보 ', '＃14']) {
  assert.equal(parseComboNumberQuery(q), 14, q); // 전각 ＃ 도 NFKC로 허용
}
for (const q of ['', '0', '14a', '3점 가드', 'x14', '14번 가드', '-1']) {
  assert.equal(parseComboNumberQuery(q), null, q);
}
assert.equal(parseComboNumberParam('14'), 14);
assert.equal(parseComboNumberParam('6ac879321ae5cca6cc9c2882'), null); // ObjectId는 번호가 아니다
assert.equal(parseComboNumberParam('0'), null);

// 공유 문구
assert.equal(comboShareText(14, 'https://www.ossground.com/'), '14번 콤보 · https://www.ossground.com/combo/14');

// 시전자 정규화
assert.equal(normalizePerformer('  케네디   마시엘 '), '케네디 마시엘');
assert.equal(normalizePerformer('   '), undefined);

// 시연 중복 키: 링크 형식이 달라도 같은 영상+같은 시작 시간이면 같은 키
const v = 'dQw4w9WgXcQ';
assert.equal(demoVideoKey(`https://www.youtube.com/watch?v=${v}&t=90s`), `${v}@90`);
assert.equal(demoVideoKey(`https://youtu.be/${v}?t=90`), `${v}@90`);
assert.equal(demoVideoKey(`https://www.youtube.com/watch?v=${v}&t=1m30s`), `${v}@90`);
assert.equal(demoVideoKey(`https://www.youtube.com/watch?v=${v}`), `${v}@0`);
assert.notEqual(demoVideoKey(`https://youtu.be/${v}?t=91`), demoVideoKey(`https://youtu.be/${v}?t=90`));
assert.equal(demoVideoKey(''), null);

// 시작 시간이 임베드에 반영된다
assert.equal(getYoutubeEmbedUrl(`https://www.youtube.com/watch?v=${v}&t=3682s`), `https://www.youtube.com/embed/${v}?start=3682`);
assert.equal(getYoutubeEmbedUrl(`https://youtu.be/${v}?t=1h1m22s`), `https://www.youtube.com/embed/${v}?start=3682`);

// 시연 검증
let r = validateDemoInput({});
assert.equal(r.ok, false); // 시전자/영상 중 하나는 필요
r = validateDemoInput({ performer: 'x'.repeat(41) });
assert.equal(r.ok, false);
r = validateDemoInput({ performer: 'x'.repeat(40) });
assert.equal(r.ok, true);
r = validateDemoInput({ videoUrl: 'https://example.com/a' });
assert.equal(r.ok, false);
r = validateDemoInput({ performer: '마이키', gearType: 'gi' });
assert.ok(r.ok && r.demo.gearType === 'unknown'); // 영상이 없으면 복장은 unknown
r = validateDemoInput({ videoUrl: `https://youtu.be/${v}?t=5`, gearType: 'nogi' });
assert.ok(r.ok && r.demo.gearType === 'nogi' && r.demo.videoKey === `${v}@5`);
r = validateDemoInput({ videoUrl: `https://youtu.be/${v}`, gearType: 'bad' });
assert.equal(r.ok, false);

// 카드 요약
const none = summarizeDemos([]);
assert.deepEqual([none.performerLine, none.gearTypes, none.videoCount], [null, [], 0]);
const one = summarizeDemos([{ performer: '케네디 마시엘', videoUrl: 'u', gearType: 'gi' }]);
assert.equal(one.performerLine, '케네디 마시엘');
const many = summarizeDemos([
  { performer: '케네디 마시엘', videoUrl: 'u', gearType: 'gi' },
  { performer: ' 마이키 ', videoUrl: 'u2', gearType: 'nogi' },
  { videoUrl: 'u3', gearType: 'unknown' },
  { performer: '마이키' },
]);
assert.equal(many.performerLine, '케네디 마시엘 외 1명');
assert.deepEqual(many.gearTypes, ['gi', 'nogi']);
assert.equal(many.videoCount, 3);
assert.equal(summarizeDemos([{ videoUrl: 'u', gearType: 'unknown' }]).performerLine, null);

console.log('combo-chain: all checks passed');
