import dbConnect from '@/lib/db';
import User from '@/models/User';
import Technique from '@/models/Technique';
import Combo from '@/models/Combo';
import TechniqueView from '@/models/TechniqueView';
import { canonicalTechniquePath } from '@/lib/technique-url';

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 'YYYY-MM-DD' (KST). 일별 집계의 버킷 키로 쓴다.
export function kstDay(date: Date | number = Date.now()): string {
  return new Date(new Date(date).getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

// KST 기준 오늘 0시(UTC Date)
function kstTodayStart(): Date {
  const day = kstDay();
  return new Date(new Date(`${day}T00:00:00.000Z`).getTime() - KST_OFFSET_MS);
}

export interface AdminUserRow {
  id: string;
  nickname: string;
  email: string;
  role: 'user' | 'admin';
  method: 'email' | 'google';
  createdAt: string;
}

export interface TopTechniqueRow {
  id: string;
  name: string;
  href: string;
  views: number;
}

export interface AdminStats {
  users: { total: number; today: number; last7d: number; last30d: number };
  techniques: { total: number; last7d: number };
  combos: { total: number; last7d: number };
  signupsByDay: { day: string; count: number }[];
  recentUsers: AdminUserRow[];
  topTechniques: { last7d: TopTechniqueRow[]; last30d: TopTechniqueRow[]; all: TopTechniqueRow[] };
}

export async function getAdminUsers(limit: number, page: number) {
  await dbConnect();
  const [docs, total] = await Promise.all([
    User.find()
      // 오래된 문서는 createdAt이 없을 수 있어 ObjectId(생성 시각 포함) 역순으로 정렬한다.
      .sort({ _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      // 민감 필드(password, googleId 값 등)는 가져오지 않는다. 가입 방식은 googleId 존재 여부로만 판단.
      .select('nickname email role createdAt googleId')
      .lean(),
    User.countDocuments(),
  ]);

  const users: AdminUserRow[] = docs.map((u) => ({
    id: u._id.toString(),
    nickname: u.nickname,
    email: u.email,
    role: u.role,
    method: u.googleId ? 'google' : 'email',
    createdAt: (u.createdAt ?? u._id.getTimestamp()).toISOString(),
  }));
  return { users, total, page, limit };
}

async function topByRange(days: number | null, limit: number): Promise<TopTechniqueRow[]> {
  let rows: { id: string; views: number }[];
  if (days === null) {
    const docs = await Technique.find({ status: 'published' })
      .sort({ viewCount: -1 })
      .limit(limit * 2)
      .select('_id viewCount')
      .lean();
    rows = docs
      .map((d) => ({ id: d._id.toString(), views: d.viewCount ?? 0 }))
      .filter((r) => r.views > 0);
  } else {
    const from = kstDay(Date.now() - (days - 1) * DAY_MS);
    const agg = await TechniqueView.aggregate<{ _id: unknown; views: number }>([
      { $match: { day: { $gte: from } } },
      { $group: { _id: '$technique', views: { $sum: '$count' } } },
      { $sort: { views: -1 } },
      { $limit: limit * 2 },
    ]);
    rows = agg.map((a) => ({ id: String(a._id), views: a.views }));
  }

  const techniques = await Technique.find({
    _id: { $in: rows.map((r) => r.id) },
    status: 'published',
  })
    .select('name slug pathSlugs')
    .lean();
  const byId = new Map(techniques.map((t) => [t._id.toString(), t]));

  const result: TopTechniqueRow[] = [];
  for (const r of rows) {
    const t = byId.get(r.id);
    if (!t) continue;
    result.push({ id: r.id, name: t.name.ko, href: canonicalTechniquePath(t), views: r.views });
    if (result.length >= limit) break;
  }
  return result;
}

export async function getAdminStats(): Promise<AdminStats> {
  await dbConnect();
  const todayStart = kstTodayStart();
  const since = (days: number) => new Date(Date.now() - days * DAY_MS);
  const chartStart = new Date(todayStart.getTime() - 29 * DAY_MS);

  const [
    userTotal,
    userToday,
    user7d,
    user30d,
    techTotal,
    tech7d,
    comboTotal,
    combo7d,
    signupAgg,
    recent,
    top7d,
    top30d,
    topAll,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: todayStart } }),
    User.countDocuments({ createdAt: { $gte: since(7) } }),
    User.countDocuments({ createdAt: { $gte: since(30) } }),
    Technique.countDocuments({ status: 'published' }),
    Technique.countDocuments({ status: 'published', createdAt: { $gte: since(7) } }),
    Combo.countDocuments(),
    Combo.countDocuments({ createdAt: { $gte: since(7) } }),
    User.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: chartStart } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Seoul' } },
          count: { $sum: 1 },
        },
      },
    ]),
    getAdminUsers(20, 1),
    topByRange(7, 20),
    topByRange(30, 20),
    topByRange(null, 20),
  ]);

  const counts = new Map(signupAgg.map((a) => [a._id, a.count]));
  const signupsByDay = Array.from({ length: 30 }, (_, i) => {
    const day = kstDay(chartStart.getTime() + i * DAY_MS);
    return { day, count: counts.get(day) ?? 0 };
  });

  return {
    users: { total: userTotal, today: userToday, last7d: user7d, last30d: user30d },
    techniques: { total: techTotal, last7d: tech7d },
    combos: { total: comboTotal, last7d: combo7d },
    signupsByDay,
    recentUsers: recent.users,
    topTechniques: { last7d: top7d, last30d: top30d, all: topAll },
  };
}
