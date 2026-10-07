import dbConnect from '@/lib/db';
import Announcement from '@/models/Announcement';
import { unstable_cache } from 'next/cache';

export interface ActiveAnnouncement {
  _id: string;
  text: string;
  href: string | null;
}

const MAX_TICKER_ITEMS = 10;

// 노출 중인(숨기지 않았고 만료 전인) 공지. 만료는 시간이 지나며 생기므로 짧게(5분) 캐시하고,
// 관리자가 공지를 바꾸면 'announcements' 태그로 즉시 갱신한다.
export const getActiveAnnouncements = unstable_cache(
  async (): Promise<ActiveAnnouncement[]> => {
    await dbConnect();
    const docs = await Announcement.find({
      active: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    })
      .sort({ createdAt: -1 })
      .limit(MAX_TICKER_ITEMS)
      .select('text href')
      .lean();
    return docs.map((d) => ({ _id: d._id.toString(), text: d.text, href: d.href || null }));
  },
  ['active-announcements'],
  { revalidate: 300, tags: ['announcements'] }
);
