'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Bookmark, Clock, Link2, Pencil, Play, Plus, Share2, Trash2 } from 'lucide-react';
import { getYoutubeEmbedUrl, getYoutubeThumbnailUrl } from '@/lib/youtube';
import { comboShareText } from '@/lib/combo-chain';
import { ComboChips } from '@/components/combo/ComboChips';
import { GEAR_BADGE, type ComboDemoItem, type ComboListItem } from '@/components/combo/ComboCard';
import { DemoFormModal } from '@/components/combo/DemoFormModal';
import type { DemoFormValue } from '@/components/combo/DemoFields';
import { TechniqueChainEditor, type ChainItem } from '@/components/combo/TechniqueChainEditor';

interface PendingDemoRequest {
  _id: string;
  type: 'add_demo' | 'edit_demo' | 'delete_demo';
  demoId: string | null;
  demo: { performer?: string; videoUrl?: string; gearType?: string } | null;
  before: { performer?: string; videoUrl?: string; gearType?: string } | null;
  requestedBy: { _id: string; nickname: string } | null;
}

interface ComboDetailData extends ComboListItem {
  pendingRequests: PendingDemoRequest[];
  creation: { _id: string; status: string; reviewNote: string | null; resubmitted: boolean } | null;
}

type DemoModal =
  | { mode: 'add' }
  | { mode: 'edit'; demo: ComboDemoItem }
  | null;

function techniqueHref(t: { slug: string; pathSlugs: string[] }) {
  return `/technique/${[...(t.pathSlugs || []), t.slug].join('/')}`;
}

function formatDate(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('ko-KR');
}

export function ComboDetail({ comboKey }: { comboKey: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const addDemoParam = useSearchParams().get('addDemo');
  const isAdmin = session?.user?.role === 'admin';

  const [combo, setCombo] = useState<ComboDetailData | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [modal, setModal] = useState<DemoModal>(null);
  const [activeDemoId, setActiveDemoId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingChain, setEditingChain] = useState<ChainItem[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/combos/${comboKey}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setCombo(data.data);
        setError('');
      } else {
        setError(data.error || '콤보를 불러오지 못했습니다.');
      }
    } catch {
      setError('오류가 발생했습니다.');
    }
  }, [comboKey]);

  useEffect(() => {
    load();
  }, [load]);

  // 중복 안내에서 "시연 추가 요청"으로 들어온 경우 폼을 바로 연다.
  useEffect(() => {
    if (addDemoParam && combo?.status === 'published' && session) setModal({ mode: 'add' });
  }, [addDemoParam, combo?.status, session]);

  useEffect(() => {
    if (!combo || activeDemoId) return;
    const first = combo.demos.find((d) => d.videoUrl);
    if (first) setActiveDemoId(first._id);
  }, [combo, activeDemoId]);

  const pending = combo ? combo.status !== 'published' : false;
  const label = combo?.number ? `${combo.number}번 콤보` : '승인 대기 중인 콤보';
  const canCancel = !!combo && combo.status === 'pending' && (combo.isMine || isAdmin);

  async function handleSaveToggle() {
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    if (!combo || pending) return;
    setSavingBookmark(true);
    try {
      const res = await fetch(`/api/combos/${combo._id}/save`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCombo((prev) => (prev ? { ...prev, savedByMe: data.data.saved, saveCount: data.data.saveCount } : prev));
      } else {
        setError(data.error || '저장하지 못했습니다.');
      }
    } catch {
      setError('오류가 발생했습니다.');
    } finally {
      setSavingBookmark(false);
    }
  }

  async function handleCopyLink() {
    if (!combo?.number) return;
    const text = comboShareText(combo.number, window.location.origin);
    try {
      // 모바일은 공유 시트를 우선 사용한다.
      if (typeof navigator.share === 'function' && /Mobi|Android/i.test(navigator.userAgent)) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 사용자가 공유를 취소한 경우 등: 조용히 무시
    }
  }

  async function postJson(url: string, body?: unknown, method = 'POST'): Promise<string | null> {
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) return null;
      return data.error || '처리하지 못했습니다.';
    } catch {
      return '오류가 발생했습니다.';
    }
  }

  async function submitDemo(value: DemoFormValue): Promise<string | null> {
    if (!combo || !modal) return '콤보를 찾을 수 없습니다.';
    const body = {
      comboId: String(combo.number ?? combo._id),
      type: modal.mode === 'add' ? 'add_demo' : 'edit_demo',
      demoId: modal.mode === 'edit' ? modal.demo._id : undefined,
      demo: value,
    };
    try {
      const res = await fetch('/api/combo-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) return data.error || '요청하지 못했습니다.';
      setNotice(
        data.data.applied
          ? '반영되었어요.'
          : '요청이 접수되었어요. 관리자 승인 후 반영됩니다.'
      );
      await load();
      return null;
    } catch {
      return '오류가 발생했습니다.';
    }
  }

  async function requestDeleteDemo(demo: ComboDemoItem) {
    if (!combo) return;
    const message = isAdmin ? '이 시연을 삭제할까요?' : '이 시연의 삭제를 요청할까요?';
    if (!window.confirm(message)) return;
    const res = await fetch('/api/combo-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comboId: String(combo.number ?? combo._id), type: 'delete_demo', demoId: demo._id }),
    });
    const data = await res.json();
    if (!data.success) {
      setError(data.error || '요청하지 못했습니다.');
      return;
    }
    setError('');
    setNotice(data.data.applied ? '삭제되었어요.' : '삭제 요청이 접수되었어요. 관리자 승인 후 반영됩니다.');
    await load();
  }

  async function cancelCombo() {
    if (!combo?.creation) return;
    const message = await postJson(`/api/combo-requests/${combo.creation._id}/cancel`);
    if (message) setError(message);
    else router.push('/combo');
  }

  async function cancelDemoRequest(requestId: string) {
    const message = await postJson(`/api/combo-requests/${requestId}/cancel`);
    if (message) setError(message);
    else {
      setNotice('요청을 취소했어요.');
      await load();
    }
  }

  async function deleteCombo() {
    if (!combo) return;
    const message = await postJson(`/api/combos/${combo._id}`, undefined, 'DELETE');
    if (message) setError(message);
    else router.push('/combo');
  }

  async function saveChain() {
    if (!combo || !editingChain) return;
    const message = await postJson(
      `/api/combos/${combo._id}`,
      { techniques: editingChain.map((c) => c._id) },
      'PATCH'
    );
    if (message) {
      setError(message);
      return;
    }
    setEditingChain(null);
    setError('');
    await load();
  }

  if (error && !combo) {
    return (
      <div className="container max-w-2xl py-10">
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">{error}</div>
      </div>
    );
  }
  if (!combo) {
    return <div className="container max-w-2xl py-10 text-muted-foreground">불러오는 중...</div>;
  }

  const activeDemo = combo.demos.find((d) => d._id === activeDemoId && d.videoUrl);
  const pendingByDemo = new Map(
    combo.pendingRequests.filter((r) => r.demoId).map((r) => [r.demoId as string, r])
  );
  const pendingAdds = combo.pendingRequests.filter((r) => r.type === 'add_demo');

  return (
    <div className="container max-w-2xl py-6 lg:py-10">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{label}</h1>
          {combo.createdBy && (
            <p className="mt-1 text-sm text-muted-foreground">
              등록 {combo.createdBy.nickname}
              {combo.publishedAt ? ` · ${formatDate(combo.publishedAt)}` : ''}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            disabled={pending}
            title={pending ? '승인 후 이용할 수 있어요' : undefined}
            className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copied ? <Link2 className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            {copied ? '복사됨' : '링크 복사'}
          </button>
          <button
            type="button"
            onClick={handleSaveToggle}
            disabled={savingBookmark || pending}
            title={pending ? '승인 후 이용할 수 있어요' : undefined}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              combo.savedByMe
                ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                : 'border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <Bookmark className={`h-4 w-4 ${combo.savedByMe ? 'fill-current' : ''}`} />
            저장 {combo.saveCount}
          </button>
        </div>
      </div>

      {pending && (
        <p className="mb-4 text-xs text-muted-foreground">승인 후 이용할 수 있어요 (저장·공유)</p>
      )}

      {combo.status === 'pending' && (
        <div className="mb-6 space-y-2 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="flex items-center gap-2 font-medium">
            <Clock className="h-4 w-4" />
            승인 대기 중이에요. 관리자 승인 후 전체 공개되고 번호가 부여됩니다.
          </p>
          {canCancel && combo.creation && (
            <button
              type="button"
              onClick={cancelCombo}
              className="rounded-md border border-amber-400 bg-background px-3 py-1.5 font-medium text-foreground hover:bg-muted/50"
            >
              요청 취소
            </button>
          )}
        </div>
      )}

      {combo.status === 'rejected' && (
        <div className="mb-6 space-y-2 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          <p className="font-medium">반려된 요청이에요.</p>
          {combo.creation?.reviewNote && <p>사유: {combo.creation.reviewNote}</p>}
          {combo.creation && !combo.creation.resubmitted && (
            <Link
              href={`/combo/new?resubmit=${combo.creation._id}`}
              className="inline-block rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-primary/90"
            >
              수정해서 다시 요청
            </Link>
          )}
        </div>
      )}

      {notice && (
        <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-900 dark:bg-green-950/40 dark:text-green-100">
          {notice}
        </div>
      )}
      {error && <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <section className="mb-8">
        {editingChain ? (
          <div className="space-y-3">
            <TechniqueChainEditor chain={editingChain} onChange={setEditingChain} />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveChain}
                disabled={editingChain.length < 2}
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
              >
                기술 순서 저장
              </button>
              <button
                type="button"
                onClick={() => setEditingChain(null)}
                className="rounded-md bg-muted px-3 py-1.5 text-sm text-muted-foreground"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <ComboChips
            items={combo.techniques.map((t) => ({ name: t.name.ko, href: techniqueHref(t) }))}
          />
        )}
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">시연 {combo.demos.length > 0 ? combo.demos.length : ''}</h2>
          {combo.status === 'published' && session && (
            <button
              type="button"
              onClick={() => setModal({ mode: 'add' })}
              className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
            >
              <Plus className="h-4 w-4" />
              {isAdmin ? '시연 추가' : '시연 추가 요청'}
            </button>
          )}
        </div>

        {combo.demos.length === 0 && pendingAdds.length === 0 && (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            아직 등록된 시연이 없어요.
          </p>
        )}

        <ul className="space-y-4">
          {combo.demos.map((demo) => {
            const isActive = activeDemo?._id === demo._id;
            const thumb = demo.videoUrl ? getYoutubeThumbnailUrl(demo.videoUrl) : null;
            const badge = demo.gearType === 'gi' || demo.gearType === 'nogi' ? GEAR_BADGE[demo.gearType] : null;
            const pendingForDemo = pendingByDemo.get(demo._id);
            return (
              <li key={demo._id} className="overflow-hidden rounded-lg border bg-card">
                {demo.videoUrl &&
                  (isActive ? (
                    <div className="aspect-video w-full bg-muted/50">
                      <iframe
                        src={getYoutubeEmbedUrl(demo.videoUrl)}
                        title={demo.performer ? `${label} · ${demo.performer}` : label}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="h-full w-full"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveDemoId(demo._id)}
                      aria-label="영상 재생"
                      className="relative block aspect-video w-full bg-muted"
                    >
                      {thumb && <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />}
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/70 text-white">
                          <Play className="h-6 w-6 fill-current" />
                        </span>
                      </span>
                    </button>
                  ))}

                <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {demo.performer ? (
                        <Link
                          href={`/combo?performer=${encodeURIComponent(demo.performer)}`}
                          className="font-medium hover:underline"
                        >
                          {demo.performer}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">시전자 미상</span>
                      )}
                      {badge && (
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      )}
                      {pendingForDemo && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                          {pendingForDemo.type === 'delete_demo' ? '삭제 요청 대기' : '수정 요청 대기'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {demo.createdBy ? `등록 ${demo.createdBy.nickname}` : '등록자 미상'}
                      {demo.createdAt ? ` · ${formatDate(demo.createdAt)}` : ''}
                    </p>
                  </div>

                  {session && combo.status === 'published' && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => setModal({ mode: 'edit', demo })}
                        disabled={!!pendingForDemo && !isAdmin}
                        className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {isAdmin ? '수정' : '수정 요청'}
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDeleteDemo(demo)}
                        disabled={!!pendingForDemo && !isAdmin}
                        className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {isAdmin ? '삭제' : '삭제 요청'}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}

          {/* 내가 요청한 시연(승인 대기): 목록 맨 아래, 본인에게만 보인다 */}
          {pendingAdds.map((req) => (
            <li key={req._id} className="rounded-lg border border-dashed bg-card p-3 opacity-70">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      승인 대기
                    </span>
                    <span className="font-medium">{req.demo?.performer || '시전자 미상'}</span>
                  </div>
                  {req.demo?.videoUrl && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">{req.demo.videoUrl}</p>
                  )}
                </div>
                {(req.requestedBy?._id === session?.user?.id || isAdmin) && (
                  <button
                    type="button"
                    onClick={() => cancelDemoRequest(req._id)}
                    className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                  >
                    요청 취소
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {isAdmin && (
        <section className="flex flex-wrap gap-2 border-t pt-4">
          {combo.status === 'published' && !editingChain && (
            <button
              type="button"
              onClick={() => setEditingChain(combo.techniques.map((t) => ({ _id: t._id, name: t.name })))}
              className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
            >
              기술 순서 수정 (번호 유지)
            </button>
          )}
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              콤보 삭제
            </button>
          ) : (
            <span className="flex items-center gap-2 text-sm">
              <span className="text-destructive">번호는 재사용되지 않고 결번이 됩니다. 삭제할까요?</span>
              <button
                type="button"
                onClick={deleteCombo}
                className="rounded-md bg-destructive px-3 py-1.5 text-destructive-foreground"
              >
                삭제
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-md bg-muted px-3 py-1.5 text-muted-foreground"
              >
                취소
              </button>
            </span>
          )}
        </section>
      )}

      {modal && (
        <DemoFormModal
          title={
            modal.mode === 'add'
              ? isAdmin
                ? '시연 추가'
                : '시연 추가 요청'
              : isAdmin
                ? '시연 수정'
                : '시연 수정 요청'
          }
          description={isAdmin ? undefined : '관리자 승인 후 반영돼요.'}
          initial={
            modal.mode === 'edit'
              ? {
                  performer: modal.demo.performer ?? '',
                  videoUrl: modal.demo.videoUrl ?? '',
                  gearType: modal.demo.gearType,
                }
              : { performer: '', videoUrl: '', gearType: 'unknown' }
          }
          submitLabel={isAdmin ? '저장' : '요청 보내기'}
          onSubmit={submitDemo}
          onClose={() => {
            setModal(null);
            if (addDemoParam) router.replace(`/combo/${combo.number ?? combo._id}`);
          }}
        />
      )}
    </div>
  );
}
