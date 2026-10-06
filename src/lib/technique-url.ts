// 기술 상세 주소(/technique/<상위 경로...>/<slug>)의 정식 주소 판정.
// 의존성이 없어 DB 없이 검증할 수 있다.

/** 정식 주소: 상위 경로(pathSlugs) + 자기 slug. */
export function canonicalTechniquePath(target: { slug: string; pathSlugs?: readonly string[] }): string {
  return `/technique/${[...(target.pathSlugs ?? []), target.slug].join('/')}`;
}

/** 주소에 들어온 조각이 퍼센트 인코딩되어 있어도 안전하게 풀어 준다 (잘못된 인코딩은 그대로 둔다). */
export function safeDecodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * 요청 주소가 정식 주소와 다르면 정식 주소를, 같으면 null을 돌려준다.
 * 기술은 마지막 조각(slug)으로 찾으므로, 분류를 옮기거나 slug를 바꾼 뒤에도 옛 주소로 들어오면
 * 여기서 새 정식 주소로 보내게 된다.
 */
export function redirectTargetFor(
  requested: readonly string[],
  target: { slug: string; pathSlugs?: readonly string[] }
): string | null {
  const canonical = canonicalTechniquePath(target);
  const requestedPath = `/technique/${requested.map(safeDecodeSegment).join('/')}`;
  return requestedPath === canonical ? null : canonical;
}
