const YOUTUBE_ID_PATTERNS = [
  /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/,
  /youtu\.be\/([\w-]{11})/,
  /youtube\.com\/shorts\/([\w-]{11})/,
  /youtube\.com\/embed\/([\w-]{11})/,
];

/** 유튜브 URL(watch, youtu.be, shorts, embed)에서 11자리 영상 ID를 뽑는다. 유튜브가 아니면 null. */
export function getYoutubeVideoId(url: string): string | null {
  if (!url) return null;
  for (const pattern of YOUTUBE_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** 다양한 유튜브 URL 형식(watch, youtu.be, shorts, embed)을 임베드용 URL로 정규화한다. */
export function getYoutubeEmbedUrl(url: string): string {
  const id = getYoutubeVideoId(url);
  return id ? `https://www.youtube.com/embed/${id}` : url;
}

/**
 * 영상 ID로 썸네일 주소를 만든다. maxresdefault는 영상에 따라 없을 수 있어
 * 항상 존재하는 hqdefault(480x360)를 쓴다.
 * 참고: https://www.sitepoint.com/youtube-video-thumbnail-urls/
 */
export function getYoutubeThumbnailUrl(url: string): string | null {
  const id = getYoutubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

/** 영상 URL 목록에서 처음으로 썸네일을 만들 수 있는 유튜브 영상의 썸네일 주소. */
export function getFirstYoutubeThumbnail(urls: readonly string[]): string | null {
  for (const url of urls) {
    const thumb = getYoutubeThumbnailUrl(url);
    if (thumb) return thumb;
  }
  return null;
}
