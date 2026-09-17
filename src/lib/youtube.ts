const YOUTUBE_ID_PATTERNS = [
  /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/,
  /youtu\.be\/([\w-]{11})/,
  /youtube\.com\/shorts\/([\w-]{11})/,
  /youtube\.com\/embed\/([\w-]{11})/,
];

/** 다양한 유튜브 URL 형식(watch, youtu.be, shorts, embed)을 임베드용 URL로 정규화한다. */
export function getYoutubeEmbedUrl(url: string): string {
  if (!url) return url;
  for (const pattern of YOUTUBE_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
  }
  return url;
}
