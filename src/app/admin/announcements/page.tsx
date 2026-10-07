'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { ANNOUNCEMENT_TEXT_MAX, type AnnouncementState } from '@/lib/announcement';

interface AnnouncementRow {
  _id: string;
  text: string;
  href: string | null;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
  state: AnnouncementState;
}

const STATE_LABELS: Record<AnnouncementState, string> = {
  live: '노출 중',
  hidden: '숨김',
  expired: '만료됨',
};

const STATE_STYLES: Record<AnnouncementState, string> = {
  live: 'bg-green-100 text-green-800',
  hidden: 'bg-gray-100 text-gray-700',
  expired: 'bg-amber-100 text-amber-800',
};

const inputClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export default function AdminAnnouncementsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [href, setHref] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = status === 'authenticated' && session?.user?.role === 'admin';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated' && session?.user?.role !== 'admin') {
      router.push('/');
    }
  }, [status, session, router]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/announcements');
      const data = await res.json();
      if (data.success) {
        setRows(data.data);
        setError('');
      } else {
        setError(data.error || '불러오지 못했습니다.');
      }
    } catch {
      setError('불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  async function request(url: string, init: RequestInit, failMessage: string): Promise<boolean> {
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || failMessage);
        return false;
      }
      setError('');
      return true;
    } catch {
      setError(failMessage);
      return false;
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const ok = await request(
      '/api/admin/announcements',
      {
        method: 'POST',
        body: JSON.stringify({ text, href, expiresAt: expiresAt || null }),
      },
      '등록하지 못했습니다.'
    );
    setSaving(false);
    if (ok) {
      setText('');
      setHref('');
      setExpiresAt('');
      await load();
      router.refresh();
    }
  }

  async function handleToggle(row: AnnouncementRow) {
    const ok = await request(
      `/api/admin/announcements/${row._id}`,
      { method: 'PATCH', body: JSON.stringify({ active: !row.active }) },
      '변경하지 못했습니다.'
    );
    if (ok) {
      await load();
      router.refresh();
    }
  }

  async function handleDelete(row: AnnouncementRow) {
    if (!confirm(`"${row.text}" 공지를 삭제할까요?`)) return;
    const ok = await request(`/api/admin/announcements/${row._id}`, { method: 'DELETE' }, '삭제하지 못했습니다.');
    if (ok) {
      await load();
      router.refresh();
    }
  }

  if (status === 'loading') {
    return <div className="p-8">Loading...</div>;
  }
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container max-w-3xl py-6 lg:py-10">
      <Link href="/admin" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="mr-1 h-4 w-4" />
        관리자 대시보드
      </Link>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">공지 관리</h1>
        <p className="text-sm text-muted-foreground">
          홈 상단에 흐르는 공지입니다. 기술이 수정되었다는 알림은 여기에 올라가지 않으며, 홈의 &quot;최근 추가&quot;에서 확인할 수 있습니다.
        </p>
      </div>

      {error && <div className="mb-4 rounded-md bg-destructive/10 p-4 text-destructive">{error}</div>}

      <form onSubmit={handleCreate} className="mb-8 space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold">새 공지</h2>
        <div className="grid gap-2">
          <label className="text-sm font-medium">내용</label>
          <input
            required
            maxLength={ANNOUNCEMENT_TEXT_MAX}
            className={inputClass}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="예: 10월 12일 새벽 2시~4시 서버 점검이 있습니다."
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-sm font-medium">링크 (선택)</label>
            <input
              className={inputClass}
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="/technique/guard 또는 https://..."
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">노출 종료일 (선택, 한국 시간 그날 끝까지)</label>
            <input
              type="date"
              className={inputClass}
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving || !text.trim()}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? '등록 중...' : '공지 등록'}
        </button>
      </form>

      {loading ? (
        <p className="text-muted-foreground">불러오는 중...</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">등록된 공지가 없습니다. 노출 중인 공지가 없으면 홈 상단 공지 바는 보이지 않습니다.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row._id} className="flex items-start justify-between gap-3 rounded-lg border p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE_STYLES[row.state]}`}>
                    {STATE_LABELS[row.state]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    등록 {formatDate(row.createdAt)}
                    {row.expiresAt && ` · ${formatDate(row.expiresAt)}까지`}
                  </span>
                </div>
                <p className="mt-1 break-words">{row.text}</p>
                {row.href && <p className="mt-0.5 break-all text-xs text-muted-foreground">{row.href}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => handleToggle(row)}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted/50"
                >
                  {row.active ? '숨기기' : '다시 노출'}
                </button>
                <button
                  onClick={() => handleDelete(row)}
                  className="rounded-md border p-2 text-destructive hover:bg-destructive/10"
                  title="삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
