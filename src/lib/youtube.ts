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

/**
 * 링크의 t 또는 start 값을 초 단위로 읽는다. 470, 470s, 1h2m3s 형식을 모두 처리하며
 * 쿼리(?t=)와 해시(#t=) 어디에 있어도 된다. 없거나 0이면 null.
 */
export function getYoutubeStartSeconds(url: string): number | null {
  const match = url.match(/[?&#](?:t|start)=([^&#]+)/);
  if (!match) return null;
  const value = match[1].toLowerCase();

  let seconds = 0;
  if (/^\d+$/.test(value)) {
    seconds = Number(value);
  } else {
    const hms = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (!hms) return null;
    seconds = Number(hms[1] ?? 0) * 3600 + Number(hms[2] ?? 0) * 60 + Number(hms[3] ?? 0);
  }
  return seconds > 0 ? seconds : null;
}

/** 다양한 유튜브 URL 형식(watch, youtu.be, shorts, embed)을 임베드용 URL로 정규화한다. 시작 시간(t/start)은 ?start=초 로 보존한다. */
export function getYoutubeEmbedUrl(url: string): string {
  const id = getYoutubeVideoId(url);
  if (!id) return url;
  const start = getYoutubeStartSeconds(url);
  return `https://www.youtube.com/embed/${id}${start ? `?start=${start}` : ''}`;
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
