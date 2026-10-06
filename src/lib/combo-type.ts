// 콤보의 기/노기 구분. 콤보에는 유형이 저장되어 있지 않아 포함된 기술들의 유형에서 계산한다.
// 의존성이 없어 DB 없이 검증할 수 있다.

export type ComboTypeFilter = 'all' | 'gi' | 'nogi';

export interface ComboTypeInfo {
  /** 모든 기술을 도복을 입고 할 수 있다 (gi 또는 공용) */
  gi: boolean;
  /** 모든 기술을 도복 없이 할 수 있다 (nogi 또는 공용) */
  nogi: boolean;
}

export function comboTypeInfo(techniqueTypes: readonly string[]): ComboTypeInfo {
  if (techniqueTypes.length === 0) return { gi: false, nogi: false };
  return {
    gi: techniqueTypes.every((t) => t === 'gi' || t === 'both'),
    nogi: techniqueTypes.every((t) => t === 'nogi' || t === 'both'),
  };
}

/** 화면에 보일 라벨. 기 전용 기술과 노기 전용 기술이 섞이면 어느 쪽으로도 이어서 할 수 없어 "혼합". */
export function comboTypeLabel(info: ComboTypeInfo): string {
  if (info.gi && info.nogi) return '기/노기 공용';
  if (info.gi) return '기';
  if (info.nogi) return '노기';
  return '기/노기 혼합';
}

export function comboMatchesType(info: ComboTypeInfo, filter: ComboTypeFilter): boolean {
  if (filter === 'gi') return info.gi;
  if (filter === 'nogi') return info.nogi;
  return true;
}
