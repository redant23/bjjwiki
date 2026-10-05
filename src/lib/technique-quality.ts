// 기술 문서의 "미완성" 판정. 의존성이 없어 DB 없이 검증할 수 있다.

export type QualityIssue = 'no_video' | 'no_thumbnail' | 'weak_structure';

export const QUALITY_ISSUE_LABELS: Record<QualityIssue, string> = {
  no_video: '영상 없음',
  no_thumbnail: '썸네일 없음',
  weak_structure: '제목 구조 부족',
};

// 설명에 마크다운 제목이 이 개수 이하면 구조가 부족한 것으로 본다.
export const MAX_WEAK_HEADING_COUNT = 2;

/** 마크다운 제목(# ~ ######) 줄 수. 코드 블록 안의 줄은 세지 않는다. */
export function countMarkdownHeadings(markdown: string | undefined | null): number {
  if (!markdown) return 0;
  let inFence = false;
  let count = 0;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && /^ {0,3}#{1,6}\s+\S/.test(line)) count++;
  }
  return count;
}

export interface QualityInput {
  videos?: ReadonlyArray<{ url?: string }> | null;
  thumbnailUrl?: string | null;
  description?: string | null;
}

export function getQualityIssues(input: QualityInput): { issues: QualityIssue[]; headingCount: number } {
  const issues: QualityIssue[] = [];
  const hasVideo = (input.videos ?? []).some((v) => v?.url?.trim());
  if (!hasVideo) issues.push('no_video');
  if (!input.thumbnailUrl?.trim()) issues.push('no_thumbnail');
  const headingCount = countMarkdownHeadings(input.description);
  if (headingCount <= MAX_WEAK_HEADING_COUNT) issues.push('weak_structure');
  return { issues, headingCount };
}
