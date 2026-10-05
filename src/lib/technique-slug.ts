// 슬러그 생성/검증 순수 함수.

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // 공백 → -
    .replace(/[^\w\-]+/g, '') // 단어 문자가 아닌 것 제거 (한글만 있으면 빈 문자열)
    .replace(/_/g, '-')
    .replace(/\-\-+/g, '-') // 연속 - 정리
    .replace(/^-+|-+$/g, ''); // 앞뒤 - 제거
}

// 소문자 영문/숫자를 하이픈으로 이은 형태만 허용한다 (URL 경로에 그대로 쓰이므로).
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return slug.length <= 80 && SLUG_PATTERN.test(slug);
}
