// 오늘의 기술 선택 규칙 검증 (DB 불필요).
import assert from 'node:assert/strict';
import { kstDateKey, pickDailyIndex } from '../src/lib/home-picks.ts';

// 한국 시간 기준 날짜: UTC 15:00부터 다음 날
assert.equal(kstDateKey(new Date('2026-10-05T14:59:59Z')), '2026-10-05');
assert.equal(kstDateKey(new Date('2026-10-05T15:00:00Z')), '2026-10-06');
assert.equal(kstDateKey(new Date('2026-12-31T16:00:00Z')), '2027-01-01');

// 같은 날·같은 개수면 항상 같은 결과, 범위 안
assert.equal(pickDailyIndex('2026-10-06', 209), pickDailyIndex('2026-10-06', 209));
for (let day = 1; day <= 365; day++) {
  const key = kstDateKey(new Date(Date.UTC(2026, 0, day)));
  const index = pickDailyIndex(key, 209);
  assert.ok(index >= 0 && index < 209, key);
}
// 날짜가 바뀌면 대체로 바뀐다 (365일 중 서로 다른 값이 충분히 많아야 함)
const seen = new Set<number>();
for (let day = 1; day <= 365; day++) seen.add(pickDailyIndex(kstDateKey(new Date(Date.UTC(2026, 0, day))), 209));
assert.ok(seen.size > 120, `distinct=${seen.size}`);

// 경계
assert.equal(pickDailyIndex('x', 0), -1);
assert.equal(pickDailyIndex('x', -3), -1);
assert.equal(pickDailyIndex('x', 1), 0);

console.log('home-picks: all checks passed');
