// 공지(상단 티커) 입력 검증과 노출 규칙. 의존성이 없어 DB 없이 검증할 수 있다.

export const ANNOUNCEMENT_TEXT_MAX = 200;
export const ANNOUNCEMENT_HREF_MAX = 500;

/** 사이트 내부 경로("/..." 단, "//"로 시작하는 외부 주소 제외) 또는 http(s) 주소만 허용한다. */
export function isValidAnnouncementHref(href: string): boolean {
  if (href.length > ANNOUNCEMENT_HREF_MAX || /\s/.test(href)) return false;
  if (href.startsWith('/')) return !href.startsWith('//');
  return /^https?:\/\/[^\s/]+/i.test(href);
}

/** "YYYY-MM-DD"를 한국 시간 그날 끝(23:59:59.999)의 Date로. 잘못된 날짜면 null. */
export function endOfDayKst(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const date = new Date(`${dateStr}T23:59:59.999+09:00`);
  if (Number.isNaN(date.getTime())) return null;
  // 2026-02-31 같은 존재하지 않는 날짜는 Date가 다음 달로 넘기므로 되돌려 확인한다.
  const roundTrip = new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return roundTrip === dateStr ? date : null;
}

export interface AnnouncementInput {
  text?: string;
  href?: string | null;
  active?: boolean;
  /** null이면 만료 없음 */
  expiresAt?: Date | null;
}

export type ParseResult =
  | { ok: true; value: AnnouncementInput }
  | { ok: false; error: string };

/**
 * 요청 본문을 검증/정리한다. partial=false(생성)이면 text가 필수.
 * 본문에 없는 필드는 결과에도 넣지 않아 부분 수정에 그대로 쓸 수 있다.
 */
export function parseAnnouncementBody(body: unknown, partial: boolean): ParseResult {
  if (!body || typeof body !== 'object') return { ok: false, error: '잘못된 요청입니다.' };
  const b = body as Record<string, unknown>;
  const value: AnnouncementInput = {};

  if ('text' in b || !partial) {
    const text = typeof b.text === 'string' ? b.text.replace(/\s+/g, ' ').trim() : '';
    if (!text) return { ok: false, error: '공지 내용을 입력해주세요.' };
    if (Array.from(text).length > ANNOUNCEMENT_TEXT_MAX) {
      return { ok: false, error: `공지 내용은 ${ANNOUNCEMENT_TEXT_MAX}자 이하로 입력해주세요.` };
    }
    value.text = text;
  }

  if ('href' in b) {
    const href = typeof b.href === 'string' ? b.href.trim() : '';
    if (href && !isValidAnnouncementHref(href)) {
      return { ok: false, error: '링크는 "/"로 시작하는 사이트 내 경로이거나 http(s) 주소여야 합니다.' };
    }
    value.href = href || null;
  }

  if ('active' in b) {
    if (typeof b.active !== 'boolean') return { ok: false, error: '잘못된 요청입니다.' };
    value.active = b.active;
  }

  if ('expiresAt' in b) {
    if (b.expiresAt === null || b.expiresAt === '') {
      value.expiresAt = null;
    } else if (typeof b.expiresAt === 'string') {
      const date = endOfDayKst(b.expiresAt);
      if (!date) return { ok: false, error: '만료일 형식이 올바르지 않습니다.' };
      value.expiresAt = date;
    } else {
      return { ok: false, error: '만료일 형식이 올바르지 않습니다.' };
    }
  }

  return { ok: true, value };
}

export type AnnouncementState = 'live' | 'hidden' | 'expired';

/** 관리 화면 표시용 상태. 숨김 처리된 공지는 만료와 무관하게 hidden. */
export function announcementState(
  a: { active: boolean; expiresAt?: Date | string | null },
  now: Date = new Date()
): AnnouncementState {
  if (!a.active) return 'hidden';
  if (a.expiresAt && new Date(a.expiresAt).getTime() <= now.getTime()) return 'expired';
  return 'live';
}
