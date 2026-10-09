import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { ChevronLeft } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import { getAdminStats, type TopTechniqueRow } from '@/lib/admin-stats';
import { StatsUsersTable } from './StatsUsersTable';

export const dynamic = 'force-dynamic';

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function SignupChart({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div>
      <div className="flex h-32 items-end gap-1">
        {data.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end" title={`${d.day}: ${d.count}명`}>
            <div
              className="w-full rounded-t bg-primary/70 group-hover:bg-primary"
              style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? 2 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{data[0]?.day.slice(5)}</span>
        <span>최대 {max}명/일</span>
        <span>{data[data.length - 1]?.day.slice(5)}</span>
      </div>
    </div>
  );
}

function TopTable({ title, rows }: { title: string; rows: TopTechniqueRow[] }) {
  return (
    <div className="rounded-lg border bg-card">
      <h3 className="border-b px-4 py-2 text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">데이터 없음</p>
      ) : (
        <ol className="divide-y text-sm">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-center gap-2 px-4 py-1.5">
              <span className="w-5 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
              <Link href={r.href} className="min-w-0 flex-1 truncate hover:underline">
                {r.name}
              </Link>
              <span className="tabular-nums text-muted-foreground">{r.views.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default async function AdminStatsPage() {
  // 클라이언트 숨김이 아니라 서버에서 role을 검사한다. 비관리자/비로그인은 404.
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') notFound();

  const stats = await getAdminStats();

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> 관리자
        </Link>
        <h1 className="mt-1 text-3xl font-bold">통계</h1>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="총 가입자" value={stats.users.total} />
        <StatCard label="오늘 신규" value={stats.users.today} />
        <StatCard label="7일 신규" value={stats.users.last7d} />
        <StatCard label="30일 신규" value={stats.users.last30d} />
        <StatCard label="총 기술" value={stats.techniques.total} sub={`최근 7일 +${stats.techniques.last7d}`} />
        <StatCard label="총 콤보" value={stats.combos.total} sub={`최근 7일 +${stats.combos.last7d}`} />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">일별 가입자 (최근 30일)</h2>
        <div className="rounded-lg border bg-card p-4">
          <SignupChart data={stats.signupsByDay} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">최근 가입자</h2>
        <StatsUsersTable users={stats.recentUsers} />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">인기 기술 Top 20 (사이트 조회수)</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <TopTable title="최근 7일" rows={stats.topTechniques.last7d} />
          <TopTable title="최근 30일" rows={stats.topTechniques.last30d} />
          <TopTable title="전체" rows={stats.topTechniques.all} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          7일/30일 집계는 이 기능 도입 이후 조회부터 쌓입니다. 관리자·봇 조회와 30분 내 재방문은 제외됩니다.
        </p>
      </section>
    </div>
  );
}
