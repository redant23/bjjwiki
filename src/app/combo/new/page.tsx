/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { TechniqueChainEditor, type ChainItem } from '@/components/combo/TechniqueChainEditor';
import { DemoFields, EMPTY_DEMO, type DemoFormValue } from '@/components/combo/DemoFields';

interface DuplicateInfo {
  status: 'published' | 'pending';
  number?: number | null;
  _id?: string;
  mine?: boolean;
}

function NewComboForm() {
  const { status, data: session } = useSession();
  const router = useRouter();
  const resubmitId = useSearchParams().get('resubmit');
  const isAdmin = session?.user?.role === 'admin';

  const [chain, setChain] = useState<ChainItem[]>([]);
  const [demo, setDemo] = useState<DemoFormValue>(EMPTY_DEMO);
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  // 반려된 요청을 수정해 다시 내는 경우: 기존 값을 채워 둔다.
  useEffect(() => {
    if (!resubmitId || status !== 'authenticated') return;
    fetch('/api/combo-requests?mine=1&status=rejected')
      .then((r) => r.json())
      .then((json) => {
        const req = json.success && json.data.find((r: any) => r._id === resubmitId);
        if (!req?.combo) return;
        setChain(req.combo.techniques.map((t: any) => ({ _id: t._id, name: t.name })));
        const d = req.payload?.demo ?? req.combo.demos?.[0];
        if (d) {
          setDemo({
            performer: d.performer ?? '',
            videoUrl: d.videoUrl ?? '',
            gearType: d.gearType ?? 'unknown',
          });
        }
      })
      .catch(() => undefined);
  }, [resubmitId, status]);

  // 기술을 추가/변경할 때마다 같은 순서의 콤보가 있는지 확인한다.
  useEffect(() => {
    if (chain.length < 2) {
      setDuplicate(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/combos/check?chain=${chain.map((c) => c._id).join(',')}`)
        .then((r) => r.json())
        .then((json) => {
          if (!cancelled && json.success) setDuplicate(json.data.duplicate);
        })
        .catch(() => undefined);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [chain]);

  const hasDemoInput = demo.performer.trim() || demo.videoUrl.trim();
  const canSubmit = chain.length >= 2 && !duplicate && !saving;

  async function handleSubmit() {
    setSaving(true);
    setError('');
    try {
      const body = {
        techniques: chain.map((c) => c._id),
        demo: hasDemoInput ? demo : undefined,
      };
      const res = await fetch(
        resubmitId ? `/api/combo-requests/${resubmitId}/resubmit` : '/api/combos',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );
      const data = await res.json();
      if (data.success) {
        if (data.data.published) router.push(`/combo/${data.data.number}`);
        else if (data.data._id) router.push(`/combo/pending/${data.data._id}`);
        else router.push('/profile/combo-requests');
      } else {
        if (data.existing) setDuplicate(data.existing);
        setError(data.error || '등록하지 못했습니다.');
      }
    } catch (err) {
      console.error(err);
      setError('오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (status !== 'authenticated') return null;

  return (
    <div className="container max-w-2xl py-6 lg:py-10">
      <h1 className="mb-2 text-3xl font-bold">{resubmitId ? '콤보 다시 요청' : '콤보 등록'}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {isAdmin
          ? '관리자는 등록 즉시 공개되고 번호가 부여돼요.'
          : '등록하면 관리자 승인 후 전체 공개되고, 그때 번호가 부여돼요.'}
      </p>

      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium">기술 순서</label>
          <TechniqueChainEditor chain={chain} onChange={setChain} disabled={saving} />
        </div>

        {duplicate?.status === 'published' && (
          <div role="alert" className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-medium">이미 등록된 콤보예요. 시연 영상과 시전자를 추가 요청할 수 있어요.</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/combo/${duplicate.number ?? duplicate._id}`}
                className="rounded-md border border-amber-400 bg-background px-3 py-1.5 font-medium text-foreground hover:bg-muted/50"
              >
                기존 콤보 보기
              </Link>
              <Link
                href={`/combo/${duplicate.number ?? duplicate._id}?addDemo=1`}
                className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-primary/90"
              >
                시연 추가 요청
              </Link>
            </div>
          </div>
        )}
        {duplicate?.status === 'pending' && (
          <div role="alert" className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-medium">같은 순서가 이미 승인 대기 중이에요.</p>
            {duplicate.mine && duplicate._id && (
              <Link href={`/combo/pending/${duplicate._id}`} className="font-medium underline">
                내 대기 콤보 보기
              </Link>
            )}
          </div>
        )}

        <div className="rounded-md border p-4">
          <h2 className="mb-1 text-sm font-semibold">첫 시연 (선택)</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            시전자와 영상 중 하나만 있어도 돼요. 콤보가 승인되면 함께 공개됩니다.
          </p>
          <DemoFields value={demo} onChange={setDemo} disabled={saving} />
        </div>

        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        <div className="flex justify-end gap-2">
          <Link
            href="/combo"
            className="flex items-center rounded-md bg-muted px-4 py-2 text-muted-foreground transition-colors hover:bg-muted/80"
          >
            취소
          </Link>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? '등록 중...' : isAdmin ? '등록' : '등록 요청'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NewComboPage() {
  return (
    <Suspense fallback={null}>
      <NewComboForm />
    </Suspense>
  );
}
