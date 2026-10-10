'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Bookmark, Plus, X } from 'lucide-react';
import { normalizePerformer } from '@/lib/combo-chain';
import { ComboCard, ComboCardSkeleton, type ComboListItem } from '@/components/combo/ComboCard';

type SortOption = 'popular' | 'recent';
type GearFilter = 'all' | 'gi' | 'nogi';

const SORT_OPTIONS = [['popular', '인기순'], ['recent', '최신순']] as const;

const TYPE_FILTERS: Array<{ value: GearFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'gi', label: '기' },
  { value: 'nogi', label: '노기' },
];

const segmentClass = (active: boolean) =>
  `h-8 whitespace-nowrap rounded px-2.5 text-sm transition-colors md:px-3 ${
    active
      ? 'bg-background font-semibold text-foreground shadow-sm'
      : 'text-muted-foreground hover:text-foreground'
  }`;

function ComboListContent() {
  const router = useRouter();
  const { status, data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';
  const searchParams = useSearchParams();
  const performerFilter = searchParams.get('performer')?.trim() || '';

  const [combos, setCombos] = useState<ComboListItem[] | null>(null);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<SortOption>('popular');
  const [gearFilter, setGearFilter] = useState<GearFilter>('all');
  const [savedOnly, setSavedOnly] = useState(false);
  const [loginHint, setLoginHint] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchCombos() {
      try {
        const res = await fetch(`/api/combos?sort=${sort}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          setCombos(data.data);
          setError('');
        } else {
          setError(data.error || '콤보 목록을 불러오지 못했습니다.');
        }
      } catch {
        if (!cancelled) setError('오류가 발생했습니다.');
      }
    }
    fetchCombos();
    return () => {
      cancelled = true;
    };
  }, [sort, status]);

  async function handleSave(comboId: string) {
    if (status !== 'authenticated') {
      router.push('/auth/signin');
      return;
    }
    setSavingId(comboId);
    try {
      const res = await fetch(`/api/combos/${comboId}/save`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCombos((prev) =>
          prev
            ? prev.map((c) =>
                c._id === comboId ? { ...c, savedByMe: data.data.saved, saveCount: data.data.saveCount } : c
              )
            : prev
        );
        setError('');
      } else {
        setError(data.error || '저장하지 못했습니다.');
      }
    } catch {
      setError('오류가 발생했습니다.');
    } finally {
      setSavingId(null);
    }
  }

  const published = combos?.filter((c) => c.status !== 'pending') ?? null;
  const pendingMine = combos?.filter((c) => c.status === 'pending') ?? [];
  const savedCount = published?.filter((c) => c.savedByMe).length ?? 0;

  const visibleCombos = published
    ? published.filter((c) => {
        if (gearFilter !== 'all' && !c.demos.some((d) => d.gearType === gearFilter)) return false;
        if (savedOnly && !c.savedByMe) return false;
        if (performerFilter) {
          const wanted = normalizePerformer(performerFilter);
          if (!c.demos.some((d) => normalizePerformer(d.performer) === wanted)) return false;
        }
        return true;
      })
    : null;

  function handleRegisterClick() {
    router.push(status === 'authenticated' ? '/combo/new' : '/auth/signin');
  }

  function toggleSavedOnly() {
    if (status !== 'authenticated') {
      setLoginHint(true);
      return;
    }
    setSavedOnly((v) => !v);
  }

  function resetFilters() {
    setGearFilter('all');
    setSavedOnly(false);
    if (performerFilter) router.replace('/combo');
  }

  const filters = (
    <div className="flex items-center gap-2" role="group" aria-label="콤보 정렬 및 필터">
      <div className="flex shrink-0 rounded-md bg-muted p-0.5">
        {SORT_OPTIONS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setSort(value)}
            aria-pressed={sort === value}
            className={segmentClass(sort === value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex shrink-0 rounded-md bg-muted p-0.5" role="group" aria-label="기/노기 필터">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setGearFilter(f.value)}
            aria-pressed={gearFilter === f.value}
            className={segmentClass(gearFilter === f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={toggleSavedOnly}
        aria-pressed={savedOnly}
        className={`flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2.5 text-sm md:gap-1.5 md:px-3 transition-colors ${
          savedOnly
            ? 'border-rose-300 bg-rose-50 font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
            : 'border-input text-muted-foreground hover:text-foreground'
        }`}
      >
        <Bookmark className={`h-3.5 w-3.5 ${savedOnly ? 'fill-current' : ''}`} />
        저장함{status === 'authenticated' ? ` ${savedCount}` : ''}
      </button>
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-4">
        <h1 className="text-[22px] font-bold leading-tight md:text-[28px]">콤보</h1>
        <div className="hidden md:block">{filters}</div>
        <button
          type="button"
          onClick={handleRegisterClick}
          aria-label="콤보 등록"
          className="ml-auto flex h-10 w-10 items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 md:w-auto md:px-4"
        >
          <Plus className="h-5 w-5 md:h-4 md:w-4" />
          <span className="hidden text-sm font-medium md:inline">콤보 등록</span>
        </button>
      </div>

      {/* 모바일: 스크롤해도 상단(네비바 h-14 아래)에 고정되는 필터 줄 */}
      <div className="sticky top-14 z-30 -mx-4 mt-2 overflow-x-auto bg-background px-4 py-2 sm:-mx-6 sm:px-6 md:hidden">
        {filters}
      </div>

      <div className="mt-4">
        {loginHint && status !== 'authenticated' && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-md border bg-muted/40 p-3 text-sm">
            <span>저장한 콤보를 보려면 로그인이 필요해요.</span>
            <Link href="/auth/signin" className="shrink-0 font-medium text-primary hover:underline">
              로그인
            </Link>
          </div>
        )}

        {performerFilter && (
          <div className="mb-4 flex items-center gap-2 text-sm">
            <span className="rounded-full bg-muted px-3 py-1">
              시전자: <strong>{performerFilter}</strong>
            </span>
            <Link href="/combo" aria-label="시전자 필터 해제" className="rounded p-1 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </Link>
          </div>
        )}

        {error && <div className="mb-4 rounded-md bg-destructive/10 p-4 text-destructive">{error}</div>}

        {pendingMine.length > 0 && !performerFilter && (
          <section className="mb-6" aria-label={isAdmin ? '승인 대기' : '내 승인 대기'}>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
              {isAdmin ? '승인 대기 (전체)' : '내 승인 대기'}
            </h2>
            <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-[repeat(auto-fill,minmax(340px,1fr))] md:gap-4">
              {pendingMine.map((combo) => (
                <ComboCard key={combo._id} combo={combo} saving={false} onToggleSave={handleSave} />
              ))}
            </div>
          </section>
        )}

        {combos === null && !error && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[repeat(auto-fill,minmax(340px,1fr))] md:gap-4">
            {[0, 1, 2, 3].map((i) => (
              <ComboCardSkeleton key={i} />
            ))}
          </div>
        )}

        {published && published.length === 0 && pendingMine.length === 0 && (
          <p className="text-muted-foreground">등록된 콤보가 없어요. 첫 콤보를 등록해보세요.</p>
        )}

        {published && published.length > 0 && visibleCombos && visibleCombos.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
            <p className="text-muted-foreground">
              {savedOnly && savedCount === 0 ? '아직 저장한 콤보가 없어요' : '조건에 맞는 콤보가 없어요'}
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted/50"
            >
              필터 초기화
            </button>
          </div>
        )}

        {visibleCombos && visibleCombos.length > 0 && (
          <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-[repeat(auto-fill,minmax(340px,1fr))] md:gap-4">
            {visibleCombos.map((combo) => (
              <ComboCard
                key={combo._id}
                combo={combo}
                saving={savingId === combo._id}
                onToggleSave={handleSave}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ComboListPage() {
  return (
    <Suspense fallback={null}>
      <ComboListContent />
    </Suspense>
  );
}
