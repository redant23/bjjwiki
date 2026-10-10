// 콤보의 기/노기 구분. 등록자가 고르는 "영상 복장"(gearType)을 그대로 쓴다.
// 구성 기술의 유형에서 계산하지 않는다. 의존성이 없어 DB 없이 검증할 수 있다.

export type ComboGearType = 'gi' | 'nogi';
export type ComboTypeFilter = 'all' | ComboGearType;

export const COMBO_GEAR_TYPES: readonly ComboGearType[] = ['gi', 'nogi'];

const GEAR_LABELS: Record<ComboGearType, string> = { gi: '기', nogi: '노기' };

export function isComboGearType(value: unknown): value is ComboGearType {
  return value === 'gi' || value === 'nogi';
}

/** 화면에 보일 라벨. gearType이 없거나 알 수 없는 값이면 "미지정". */
export function comboGearLabel(gearType: unknown): string {
  return isComboGearType(gearType) ? GEAR_LABELS[gearType] : '미지정';
}

export function comboMatchesType(gearType: unknown, filter: ComboTypeFilter): boolean {
  return filter === 'all' || gearType === filter;
}

/**
 * 마이그레이션용: 이름 말머리로 gearType을 추정한다.
 * [기] → gi, [노기] → nogi, [기/노기](공용) → gi. 말머리가 없으면 null.
 */
export function gearTypeFromComboName(name: string): ComboGearType | null {
  const match = /^\s*\[([^\]]+)\]/.exec(name);
  if (!match) return null;
  const tag = match[1].replace(/\s/g, '');
  if (tag === '노기') return 'nogi';
  if (tag === '기' || tag === '기/노기' || tag === '노기/기') return 'gi';
  return null;
}

/** 목록 카드 배지 종류. both는 말머리 [기/노기]로만 얻어진다. */
export type ComboBadgeKind = ComboGearType | 'both' | 'unknown';

const DISPLAY_PREFIX = /^\s*\[\s*(?:기\s*\/\s*노기|노기\s*\/\s*기|노기|기)\s*\]\s*/;

/** 화면 표시용 제목: 앞쪽 [기]/[노기]/[기/노기]와 뒤쪽 "연계"를 떼어낸다. 결과가 비면 원래 이름. DB 값은 바꾸지 않는다. */
export function comboDisplayTitle(name: string): string {
  const stripped = name.replace(DISPLAY_PREFIX, '').replace(/\s*연계\s*$/, '').trim();
  return stripped || name;
}

/** 배지 종류: gearType이 있으면 그것을, 없으면 이름 말머리를 파싱한다. */
export function comboBadgeKind(gearType: unknown, name: string): ComboBadgeKind {
  if (isComboGearType(gearType)) return gearType;
  const match = /^\s*\[([^\]]+)\]/.exec(name);
  if (!match) return 'unknown';
  const tag = match[1].replace(/\s/g, '');
  if (tag === '기') return 'gi';
  if (tag === '노기') return 'nogi';
  if (tag === '기/노기' || tag === '노기/기') return 'both';
  return 'unknown';
}

export function comboBadgeLabel(kind: ComboBadgeKind): string {
  return kind === 'gi' ? '기' : kind === 'nogi' ? '노기' : kind === 'both' ? '기/노기' : '미지정';
}
