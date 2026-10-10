'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getYoutubeEmbedUrl } from '@/lib/youtube';
import { DemoFields, type DemoFormValue } from '@/components/combo/DemoFields';
import { TechniqueChainEditor, type ChainItem } from '@/components/combo/TechniqueChainEditor';
import {
  chainText,
  demoText,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_STYLE,
  REQUEST_TYPE_LABEL,
  type ComboRequestItem,
} from '@/components/combo/requestFormat';

type Tab = 'pending' | 'processed';

export default function AdminComboRequestsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('pending');
  const [requests, setRequests] = useState<ComboRequestItem[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; note: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: DemoFormValue; chain: ChainItem[] | null } | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    else if (status === 'authenticated' && session?.user?.role !== 'admin') router.push('/');
  }, [status, session, router]);

  const load = useCallback(async () => {
    try {
      const statusParam = tab === 'pending' ? 'pending' : 'approved,rejected,cancelled';
      const res = await fetch(`/api/combo-requests?status=${statusParam}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setRequests(data.data);
        setError('');
      } else {
        setError(data.error || '요청 목록을 불러오지 못했습니다.');
      }
    } catch {
      setError('오류가 발생했습니다.');
    }
  }, [tab]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'admin') load();
  }, [status, session, load]);

  async function act(id: string, action: 'approve' | 'reject', body?: unknown) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/combo-requests/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json();
      if (!data.success) setError(data.error || '처리하지 못했습니다.');
      else {
        setError('');
        setRejecting(null);
        setEditing(null);
        await load();
      }
    } catch {
      setError('오류가 발생했습니다.');
    } finally {
      setBusyId(null);
    }
  }

  if (status !== 'authenticated' || session?.user?.role !== 'admin') return null;

  return (
    <div className="container py-6 lg:py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">콤보 요청</h1>
        <Link href="/admin" className="text-sm text-muted-foreground hover:underline">
          관리자 홈
        </Link>
      </div>

      <div className="mb-6 flex gap-2 border-b">
        {(['pending', 'processed'] as const).map((value) => (
          <button
            key={value}
            onClick={() => {
              setRequests(null);
              setTab(value);
            }}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === value
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {value === 'pending' ? '대기중인 요청' : '처리된 요청'}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-md bg-destructive/10 p-4 text-destructive">{error}</div>}
      {requests === null && !error && <p className="text-muted-foreground">불러오는 중...</p>}
      {requests && requests.length === 0 && (
        <p className="text-muted-foreground">
          {tab === 'pending' ? '검토할 요청이 없습니다.' : '처리된 요청이 없습니다.'}
        </p>
      )}

      <ul className="space-y-4">
        {requests?.map((req) => {
          const isCreate = req.type === 'create_combo';
          const after = req.payload.demo;
          const before = req.payload.before;
          const videoUrl = after?.videoUrl || before?.videoUrl;
          const busy = busyId === req._id;
          return (
            <li key={req._id} className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold">
                    {REQUEST_TYPE_LABEL[req.type]}
                  </span>
                  {req.combo?.number && (
                    <span className="text-sm font-semibold text-primary">#{req.combo.number}</span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${REQUEST_STATUS_STYLE[req.status]}`}
                  >
                    {REQUEST_STATUS_LABEL[req.status]}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {req.requestedBy?.nickname ?? '알 수 없음'} · {new Date(req.createdAt).toLocaleString('ko-KR')}
                </div>
              </div>

              <p className="font-medium">{chainText(req)}</p>

              <div className="grid gap-2 text-sm sm:grid-cols-2">
                {!isCreate && req.type !== 'add_demo' && (
                  <div className="rounded-md bg-muted/50 p-2">
                    <div className="text-xs text-muted-foreground">변경 전</div>
                    {demoText(before)}
                  </div>
                )}
                {req.type !== 'delete_demo' && (
                  <div className="rounded-md bg-muted/50 p-2">
                    <div className="text-xs text-muted-foreground">
                      {isCreate ? '첫 시연' : req.type === 'add_demo' ? '추가할 시연' : '변경 후'}
                    </div>
                    {isCreate && !after ? '없음' : demoText(after)}
                  </div>
                )}
                {req.type === 'delete_demo' && (
                  <div className="rounded-md bg-destructive/10 p-2">
                    <div className="text-xs text-muted-foreground">삭제할 시연</div>
                    {demoText(before)}
                  </div>
                )}
              </div>

              {videoUrl && (
                <div>
                  {previewId === req._id ? (
                    <div className="aspect-video w-full max-w-md overflow-hidden rounded-md border">
                      <iframe
                        src={getYoutubeEmbedUrl(videoUrl)}
                        title="영상 미리보기"
                        allowFullScreen
                        className="h-full w-full"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPreviewId(req._id)}
                      className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted/50"
                    >
                      영상 미리보기
                    </button>
                  )}
                </div>
              )}

              {req.status === 'rejected' && req.reviewNote && (
                <p className="text-sm text-destructive">반려 사유: {req.reviewNote}</p>
              )}
              {req.status === 'approved' && req.resultNumber && (
                <p className="text-sm text-muted-foreground">#{req.resultNumber}번 콤보로 공개됨</p>
              )}

              {req.status === 'pending' && (
                <div className="space-y-3">
                  {editing?.id === req._id && (
                    <div className="rounded-md border p-3">
                      {editing.chain && (
                        <div className="mb-4">
                          <div className="mb-2 text-sm font-medium">기술 순서</div>
                          <TechniqueChainEditor
                            chain={editing.chain}
                            onChange={(chain) => setEditing({ ...editing, chain })}
                            disabled={busy}
                          />
                        </div>
                      )}
                      <DemoFields
                        value={editing.value}
                        onChange={(value) => setEditing({ ...editing, value })}
                        disabled={busy}
                      />
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            act(req._id, 'approve', {
                              demo: editing.value,
                              ...(editing.chain ? { techniques: editing.chain.map((c) => c._id) } : {}),
                            })
                          }
                          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
                        >
                          수정 후 승인
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="rounded-md bg-muted px-3 py-1.5 text-sm text-muted-foreground"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}

                  {rejecting?.id === req._id && (
                    <div className="space-y-2 rounded-md border p-3">
                      <label className="block text-sm font-medium" htmlFor={`note-${req._id}`}>
                        반려 사유
                      </label>
                      <textarea
                        id={`note-${req._id}`}
                        value={rejecting.note}
                        onChange={(e) => setRejecting({ id: req._id, note: e.target.value })}
                        rows={2}
                        maxLength={500}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy || !rejecting.note.trim()}
                          onClick={() => act(req._id, 'reject', { reviewNote: rejecting.note })}
                          className="rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground disabled:opacity-50"
                        >
                          반려
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejecting(null)}
                          className="rounded-md bg-muted px-3 py-1.5 text-sm text-muted-foreground"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act(req._id, 'approve')}
                      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                    >
                      승인
                    </button>
                    {req.type !== 'delete_demo' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          setEditing({
                            id: req._id,
                            value: {
                              performer: after?.performer ?? '',
                              videoUrl: after?.videoUrl ?? '',
                              gearType: (after?.gearType as DemoFormValue['gearType']) ?? 'unknown',
                            },
                            chain: isCreate
                              ? (req.combo?.techniques ?? []).map((t) => ({ _id: t._id, name: t.name }))
                              : null,
                          })
                        }
                        className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted/50"
                      >
                        수정 후 승인
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setRejecting({ id: req._id, note: '' })}
                      className="rounded-md border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
                    >
                      반려
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
