import { summarizeMarkdown } from '@/lib/technique-cards';

// 홈과 탐색 페이지의 기술 카드가 함께 쓰는 데이터 모양.
export interface TechniqueCardData {
  _id: string;
  name: string;
  href: string;
  primaryRole: string;
  type: string;
  thumbnailUrl: string | null;
  summary: string;
  hasVideo: boolean;
  /** 썸네일이 없을 때 아이콘을 고르기 위한 루트 분류 이름 */
  rootName: string;
}

// 카드에 필요한 필드만 읽는다.
export const CARD_FIELDS = 'name slug pathSlugs primaryRole type thumbnailUrl videos.url description.ko';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CardDoc = any;

export function toTechniqueCard(doc: CardDoc, rootNameBySlug: Map<string, string>): TechniqueCardData {
  const pathSlugs: string[] = doc.pathSlugs || [];
  return {
    _id: doc._id.toString(),
    name: doc.name.ko,
    href: `/technique/${[...pathSlugs, doc.slug].join('/')}`,
    primaryRole: doc.primaryRole,
    type: doc.type,
    thumbnailUrl: doc.thumbnailUrl || null,
    summary: summarizeMarkdown(doc.description?.ko, 60),
    hasVideo: (doc.videos ?? []).some((v: { url?: string }) => !!v.url?.trim()),
    rootName: rootNameBySlug.get(pathSlugs[0] ?? doc.slug) ?? doc.name.ko,
  };
}
