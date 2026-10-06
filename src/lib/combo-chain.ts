// 콤보 체인에서 "이 기술 다음에 이어지는 기술"을 계산한다. 의존성이 없어 DB 없이 검증할 수 있다.

export interface FollowingTechnique {
  _id: string;
  /** 이 기술 바로 다음에 이 기술을 이은 콤보의 수 */
  count: number;
}

/**
 * 콤보들(기술 id의 순서 있는 배열)에서 techniqueId 바로 다음에 오는 기술을 모아 센다.
 * - 같은 콤보에 여러 번 나와도 그 콤보는 한 번만 센다
 * - 체인의 마지막 기술이거나 바로 다음이 자기 자신이면 건너뜀
 * - 많은 콤보에서 이어진 기술 순, 같으면 먼저 발견된 순서(= 입력한 콤보 순서)
 */
export function followingInChains(
  chains: ReadonlyArray<ReadonlyArray<string>>,
  techniqueId: string,
  limit = 12
): FollowingTechnique[] {
  const counts = new Map<string, number>(); // Map은 삽입 순서를 유지한다 → 동률일 때 먼저 발견된 순

  for (const chain of chains) {
    const nextInThisCombo = new Set<string>();
    chain.forEach((id, index) => {
      if (id !== techniqueId) return;
      const next = chain[index + 1];
      if (next !== undefined && next !== techniqueId) nextInThisCombo.add(next);
    });
    for (const next of nextInThisCombo) counts.set(next, (counts.get(next) ?? 0) + 1);
  }

  return [...counts]
    .map(([_id, count], order) => ({ _id, count, order }))
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .slice(0, Math.max(0, limit))
    .map(({ _id, count }) => ({ _id, count }));
}
