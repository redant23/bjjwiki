export const RECENT_UPDATE_WINDOW_DAYS = 3;

export function isWithinRecentWindow(
  contentUpdatedAt: string | Date | undefined | null
): boolean {
  if (!contentUpdatedAt) return false; // 레거시 기술: 편집 이력 없음 -> 최근 아님
  const ms = RECENT_UPDATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(contentUpdatedAt).getTime() < ms;
}
