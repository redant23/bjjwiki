'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { DemoFormModal } from '@/components/combo/DemoFormModal';
import {
  chainText,
  demoText,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_STYLE,
  REQUEST_TYPE_LABEL,
  type ComboRequestItem,
} from '@/components/combo/requestFormat';
import type { DemoFormValue } from '@/components/combo/DemoFields';

type StatusTab = 'all' | 'pending' | 'approved' | 'rejected';

const TABS: Array<[StatusTab, string]> = [
  ['all', '전체'],
  ['pending', '대기'],
  ['approved', '승인'],
  ['rejected', '반려'],
];

export default function MyComboRequestsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState<ComboRequestItem[] | null>(null);
  const [tab, setTab] = useState<StatusTab>('all');
  const [error, setError] = useState('');
  const [resubmitting, setResubmitting] = useState<ComboRequestItem | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/combo-requests?mine=1', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) setRequests(data.data);
      else setError(data.error || '요청 내역을 불러오지 못했습니다.');
    } catch {
      setError('오류가 발생했습니다.');
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (status === 'authenticated') load();
  }, [status, load]);

  async function cancel(id: string) {
    const res = await fetch(`/api/combo-requests/${id}/cancel`, { method: 'POST' });
    const data = await res.json();
    if (!data.success) setError(data.error || '취소하지 못했습니다.');
    else {
      setError('');
      await load();
    }
  }

  async function resubmitDemo(value: DemoFormValue): Promise<string | null> {
    if (!resubmitting) return '요청을 찾을 수 없습니다.';
    const res = await fetch(`/api/combo-requests/${resubmitting._id}/resubmit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demo: value }),
    });
    const data = await res.json();
    if (!data.success) return data.error || '다시 요청하지 못했습니다.';
    await load();
    return null;
  }

  if (status !== 'authenticated') return null;

  const visible = requests?.filter((r) => {
    if (tab === 'all') return true;
    if (tab === 'rejected') return r.status === 'rejected';
    return r.status === tab;
  });

  return (
    <div className="container max-w-2xl py-6 lg:py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">내 콤보 요청</h1>
        <Link href="/profile" className="text-sm text-muted-foreground hover:underline">
          내 정보
        </Link>
      </div>

      <div className="mb-4 flex gap-2" role="tablist">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              tab === value ? 'border-primary bg-primary/10 font-semibold' : 'text-muted-foreground hover:bg-muted/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {requests === null && !error && <p className="text-muted-foreground">불러오는 중...</p>}
      {visible && visible.length === 0 && (
        <p className="text-muted-foreground">해당하는 요청이 없어요.</p>
      )}

      <ul className="space-y-3">
        {visible?.map((req) => (
          <li key={req._id} id={req._id} className="space-y-2 rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold">
                  {REQUEST_TYPE_LABEL[req.type]}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${REQUEST_STATUS_STYLE[req.status]}`}>
                  {REQUEST_STATUS_LABEL[req.status]}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(req.createdAt).toLocaleString('ko-KR')}
              </span>
            </div>

            <p className="font-medium">
              {req.combo?.number ? <span className="mr-2 text-primary">#{req.combo.number}</span> : null}
              {chainText(req)}
            </p>
            {req.type !== 'delete_demo' && req.payload.demo && (
              <p className="text-sm text-muted-foreground">{demoText(req.payload.demo)}</p>
            )}

            {req.status === 'rejected' && req.reviewNote && (
              <p className="text-sm text-destructive">반려 사유: {req.reviewNote}</p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {req.status === 'approved' && req.combo?.number && (
                <Link href={`/combo/${req.combo.number}`} className="text-sm text-primary hover:underline">
                  {req.combo.number}번 콤보 보기
                </Link>
              )}
              {req.status === 'pending' && (
                <>
                  <button
                    type="button"
                    onClick={() => cancel(req._id)}
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted/50"
                  >
                    요청 취소
                  </button>
                  {req.type === 'create_combo' && req.combo && (
                    <Link
                      href={`/combo/pending/${req.combo._id}`}
                      className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted/50"
                    >
                      콤보 보기
                    </Link>
                  )}
                </>
              )}
              {req.status === 'rejected' && !req.resubmitted && req.type === 'create_combo' && (
                <Link
                  href={`/combo/new?resubmit=${req._id}`}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
                >
                  수정해서 다시 요청
                </Link>
              )}
              {req.status === 'rejected' && !req.resubmitted && req.type !== 'create_combo' && req.type !== 'delete_demo' && (
                <button
                  type="button"
                  onClick={() => setResubmitting(req)}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
                >
                  수정해서 다시 요청
                </button>
              )}
              {req.status === 'rejected' && !req.resubmitted && req.type === 'delete_demo' && (
                <button
                  type="button"
                  onClick={async () => {
                    const res = await fetch(`/api/combo-requests/${req._id}/resubmit`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: '{}',
                    });
                    const data = await res.json();
                    if (!data.success) setError(data.error || '다시 요청하지 못했습니다.');
                    else await load();
                  }}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
                >
                  다시 요청
                </button>
              )}
              {req.resubmitted && <span className="text-xs text-muted-foreground">다시 요청함</span>}
            </div>
          </li>
        ))}
      </ul>

      {resubmitting && (
        <DemoFormModal
          title="시연 요청 수정"
          description="수정한 내용으로 다시 요청해요."
          initial={{
            performer: resubmitting.payload.demo?.performer ?? '',
            videoUrl: resubmitting.payload.demo?.videoUrl ?? '',
            gearType: (resubmitting.payload.demo?.gearType as DemoFormValue['gearType']) ?? 'unknown',
          }}
          submitLabel="다시 요청"
          onSubmit={resubmitDemo}
          onClose={() => setResubmitting(null)}
        />
      )}
    </div>
  );
}
