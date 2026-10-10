'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ComboCard, ComboCardSkeleton, type ComboListItem } from '@/components/combo/ComboCard';

export default function SavedCombosPage() {
  const { status } = useSession();
  const router = useRouter();
  const [combos, setCombos] = useState<ComboListItem[] | null>(null);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/combos?saved=1', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setCombos(data.data);
        else setError(data.error || '저장한 콤보를 불러오지 못했습니다.');
      })
      .catch(() => setError('오류가 발생했습니다.'));
  }, [status]);

  // 카드에서 저장을 해제하면 목록에서 바로 빠진다.
  async function handleToggle(comboId: string) {
    setSavingId(comboId);
    try {
      const res = await fetch(`/api/combos/${comboId}/save`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCombos((prev) => (prev ? prev.filter((c) => c._id !== comboId || data.data.saved) : prev));
      } else {
        setError(data.error || '저장 해제하지 못했습니다.');
      }
    } catch {
      setError('오류가 발생했습니다.');
    } finally {
      setSavingId(null);
    }
  }

  if (status !== 'authenticated') return null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[22px] font-bold leading-tight md:text-[28px]">
          저장한 콤보{combos ? <span className="ml-2 text-base font-normal text-muted-foreground">{combos.length}</span> : null}
        </h1>
        <Link href="/profile" className="text-sm text-muted-foreground hover:underline">
          내 정보
        </Link>
      </div>

      {error && <div className="mb-4 rounded-md bg-destructive/10 p-4 text-destructive">{error}</div>}

      {combos === null && !error && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[repeat(auto-fill,minmax(340px,1fr))] md:gap-4">
          {[0, 1, 2].map((i) => (
            <ComboCardSkeleton key={i} />
          ))}
        </div>
      )}

      {combos && combos.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
          <p className="text-muted-foreground">아직 저장한 콤보가 없어요. 콤보 목록에서 북마크를 눌러보세요</p>
          <Link
            href="/combo"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            콤보 보러가기
          </Link>
        </div>
      )}

      {combos && combos.length > 0 && (
        <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-[repeat(auto-fill,minmax(340px,1fr))] md:gap-4">
          {combos.map((combo) => (
            <ComboCard
              key={combo._id}
              combo={{ ...combo, savedByMe: true }}
              saving={savingId === combo._id}
              onToggleSave={handleToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
