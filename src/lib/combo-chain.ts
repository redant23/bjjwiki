// 콤보 v2 순수 로직: 기술 순서 키, 번호 질의 파싱, 시연 중복 키, 시전자 이름 정규화.
// DB·프레임워크에 의존하지 않아 scripts/ 에서 그대로 검증하고 마이그레이션도 같이 쓴다.
import { getYoutubeStartSeconds, getYoutubeVideoId } from './youtube.ts';

export const MIN_COMBO_TECHNIQUES = 2;
export const MAX_PERFORMER_LENGTH = 40;

export type DemoGearType = 'gi' | 'nogi' | 'unknown';
export const DEMO_GEAR_TYPES: readonly DemoGearType[] = ['gi', 'nogi', 'unknown'];

export function isDemoGearType(value: unknown): value is DemoGearType {
  return value === 'gi' || value === 'nogi' || value === 'unknown';
}

/** 기술 id 배열(순서 있음)을 ">"로 이은 유일성 키. A→B 와 B→A, A→B 와 A→B→C 는 서로 다른 키다. */
export function buildChainKey(techniqueIds: readonly string[]): string {
  return techniqueIds.join('>');
}

/**
 * 시연 중복 판정 키. 유튜브면 "영상ID@시작초", 그 외 URL이면 공백 제거한 원문. 영상이 없으면 null.
 * 같은 영상이라도 시작 시간이 다르면 다른 시연이다.
 */
export function demoVideoKey(videoUrl: string | undefined | null): string | null {
  const url = (videoUrl ?? '').trim();
  if (!url) return null;
  const id = getYoutubeVideoId(url);
  if (!id) return url;
  return `${id}@${getYoutubeStartSeconds(url) ?? 0}`;
}

/** 시전자 이름: 앞뒤 공백 제거 후 내부 연속 공백을 하나로. 비면 undefined. */
export function normalizePerformer(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return cleaned || undefined;
}

export interface DemoInput {
  performer?: unknown;
  videoUrl?: unknown;
  gearType?: unknown;
}

export interface CleanDemo {
  performer?: string;
  videoUrl?: string;
  gearType: DemoGearType;
  videoKey?: string;
}

export type DemoValidation = { ok: true; demo: CleanDemo } | { ok: false; error: string };

const YOUTUBE_HOST = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i;

/** 시연 입력 검증. performer/videoUrl 중 하나는 필요하고, 영상은 유튜브 주소여야 한다. 영상이 없으면 gearType은 unknown. */
export function validateDemoInput(input: DemoInput): DemoValidation {
  const performerRaw = typeof input.performer === 'string' ? input.performer : '';
  const performer = normalizePerformer(performerRaw);
  if (performer && performer.length > MAX_PERFORMER_LENGTH) {
    return { ok: false, error: `시전자 이름은 ${MAX_PERFORMER_LENGTH}자 이하로 입력해주세요.` };
  }

  const videoUrl = typeof input.videoUrl === 'string' ? input.videoUrl.trim() : '';
  if (videoUrl) {
    if (!YOUTUBE_HOST.test(videoUrl) || !getYoutubeVideoId(videoUrl)) {
      return { ok: false, error: '유튜브 영상 링크를 입력해주세요.' };
    }
  }

  if (!performer && !videoUrl) {
    return { ok: false, error: '시전자 이름 또는 영상 링크 중 하나는 입력해주세요.' };
  }

  let gearType: DemoGearType = 'unknown';
  if (videoUrl) {
    if (input.gearType !== undefined && input.gearType !== '' && !isDemoGearType(input.gearType)) {
      return { ok: false, error: '영상 복장(기/노기)이 올바르지 않습니다.' };
    }
    gearType = isDemoGearType(input.gearType) ? input.gearType : 'unknown';
  }

  return {
    ok: true,
    demo: {
      performer,
      videoUrl: videoUrl || undefined,
      gearType,
      videoKey: demoVideoKey(videoUrl) ?? undefined,
    },
  };
}

/**
 * 검색어가 콤보 번호를 가리키면 그 번호. "14", "#14", "14번", "14번 콤보", "#14번 콤보" 형태만 인정한다.
 * 그 밖의 숫자 섞인 질의("3점 가드")는 null.
 */
export function parseComboNumberQuery(query: string): number | null {
  const match = /^\s*#?\s*(\d{1,6})\s*(?:번)?\s*(?:콤보)?\s*$/.exec(query.normalize('NFKC'));
  if (!match) return null;
  const n = Number(match[1]);
  return n >= 1 ? n : null;
}

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/** 주소 조각이 콤보 번호(양의 정수 문자열)인지. */
export function parseComboNumberParam(param: string): number | null {
  if (!/^\d{1,9}$/.test(param)) return null;
  const n = Number(param);
  return n >= 1 ? n : null;
}

export function isObjectIdString(value: string): boolean {
  return OBJECT_ID.test(value);
}

/** 목록/상세 표기. */
export function comboNumberLabel(number: number): string {
  return `${number}번 콤보`;
}

export function comboShareText(number: number, origin: string): string {
  return `${comboNumberLabel(number)} · ${origin.replace(/\/$/, '')}/combo/${number}`;
}

export interface DemoSummaryInput {
  performer?: string | null;
  videoUrl?: string | null;
  gearType?: string | null;
}

export interface DemoSummary {
  /** 카드 시전자 줄. 시연 1개면 이름, 2개 이상이면 "이름 외 N명". 이름이 없으면 null. */
  performerLine: string | null;
  /** 기/노기 배지 합집합 (unknown 제외) */
  gearTypes: Array<'gi' | 'nogi'>;
  /** 영상이 있는 시연 수 */
  videoCount: number;
  demoCount: number;
}

/** 카드용 시연 요약. 시전자 수는 "서로 다른 이름" 기준이고, 첫 이름은 등록 순서상 처음 나온 이름이다. */
export function summarizeDemos(demos: readonly DemoSummaryInput[]): DemoSummary {
  const names: string[] = [];
  for (const demo of demos) {
    const name = normalizePerformer(demo.performer);
    if (name && !names.includes(name)) names.push(name);
  }
  const gears = new Set<string>();
  let videoCount = 0;
  for (const demo of demos) {
    if (demo.videoUrl) videoCount += 1;
    if (demo.gearType === 'gi' || demo.gearType === 'nogi') gears.add(demo.gearType);
  }
  const performerLine =
    names.length === 0 ? null : names.length === 1 ? names[0] : `${names[0]} 외 ${names.length - 1}명`;
  return {
    performerLine,
    gearTypes: (['gi', 'nogi'] as const).filter((g) => gears.has(g)),
    videoCount,
    demoCount: demos.length,
  };
}
