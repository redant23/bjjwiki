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
