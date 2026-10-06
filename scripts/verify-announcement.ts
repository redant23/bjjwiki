// 공지 입력 검증/상태 규칙 (DB 불필요).
import assert from 'node:assert/strict';
import {
  announcementState,
  endOfDayKst,
  isValidAnnouncementHref,
  parseAnnouncementBody,
} from '../src/lib/announcement.ts';

// 링크: 내부 경로와 http(s)만, 프로토콜 상대(//)·javascript:·공백 거부
for (const ok of ['/technique/guard', '/', 'https://example.com/a?b=1', 'http://example.com']) {
  assert.equal(isValidAnnouncementHref(ok), true, ok);
}
for (const bad of ['//evil.com', 'javascript:alert(1)', 'data:text/html,x', 'ftp://x.com', 'example.com', '/a b', 'https://', 'https:// x.com']) {
  assert.equal(isValidAnnouncementHref(bad), false, bad);
}

// 만료일: 한국 시간 그날 끝, 존재하지 않는 날짜 거부
assert.equal(endOfDayKst('2026-10-06')?.toISOString(), '2026-10-06T14:59:59.999Z');
assert.equal(endOfDayKst('2026-02-31'), null);
assert.equal(endOfDayKst('2026-13-01'), null);
assert.equal(endOfDayKst('26-10-06'), null);
assert.equal(endOfDayKst('2026-10-06T00:00'), null);

// 생성: text 필수, 공백 정리, 길이 제한
assert.deepEqual(parseAnnouncementBody({ text: '  점검   안내 ' }, false), { ok: true, value: { text: '점검 안내' } });
assert.equal(parseAnnouncementBody({}, false).ok, false);
assert.equal(parseAnnouncementBody({ text: '   ' }, false).ok, false);
assert.equal(parseAnnouncementBody({ text: 'a'.repeat(201) }, false).ok, false);
assert.equal(parseAnnouncementBody({ text: 'a'.repeat(200) }, false).ok, true);
assert.equal(parseAnnouncementBody(null, false).ok, false);
assert.equal(parseAnnouncementBody({ text: 'x', href: 'javascript:1' }, false).ok, false);
assert.equal(parseAnnouncementBody({ text: 'x', expiresAt: '2026-02-31' }, false).ok, false);

// 부분 수정: 있는 필드만 결과에 포함, 빈 링크/만료는 해제(null)
assert.deepEqual(parseAnnouncementBody({ active: false }, true), { ok: true, value: { active: false } });
assert.deepEqual(parseAnnouncementBody({ href: '' }, true), { ok: true, value: { href: null } });
assert.deepEqual(parseAnnouncementBody({ expiresAt: null }, true), { ok: true, value: { expiresAt: null } });
assert.equal(parseAnnouncementBody({ active: 'yes' }, true).ok, false);
assert.equal(parseAnnouncementBody({ text: '' }, true).ok, false); // 수정에서도 빈 내용은 불가

// 상태
const now = new Date('2026-10-06T00:00:00Z');
assert.equal(announcementState({ active: true }, now), 'live');
assert.equal(announcementState({ active: true, expiresAt: new Date('2026-10-07T00:00:00Z') }, now), 'live');
assert.equal(announcementState({ active: true, expiresAt: new Date('2026-10-05T00:00:00Z') }, now), 'expired');
assert.equal(announcementState({ active: true, expiresAt: now }, now), 'expired'); // 경계: 같으면 만료
assert.equal(announcementState({ active: false, expiresAt: new Date('2026-10-05T00:00:00Z') }, now), 'hidden');

console.log('announcement: all checks passed');
