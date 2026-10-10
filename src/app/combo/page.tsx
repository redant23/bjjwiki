'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Plus } from 'lucide-react';
import { comboMatchesType, type ComboTypeFilter } from '@/lib/combo-type';
import { ComboCard, ComboCardSkeleton, type ComboListItem } from '@/components/combo/ComboCard';

type SortOption = 'popular' | 'recent';

const SORT_OPTIONS = [['popular', '인기순'], ['recent', '최신순']] as const;

const TYPE_FILTERS: Array<{ value: ComboTypeFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'gi', label: '기' },
  { value: 'nogi', label: '노기' },
];

export default function ComboListPage() {
  const router = useRouter();
  const { status } = useSession();
  const [combos, setCombos] = useState<ComboListItem[] | null>(null);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<SortOption>('popular');
  const [typeFilter, setTypeFilter] = useState<ComboTypeFilter>('all');
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchCombos() {
      try {
        const query = sort === 'recent' ? '?sort=recent' : '';
        const res = await fetch(`/api/combos${query}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          setCombos(data.data);
          setError('');
        } else {
          setError(data.error || '콤보 목록을 불러오지 못했습니다.');
        }
      } catch {
        if (!cancelled) {
          setError('오류가 발생했습니다.');
        }
      }
    }
    fetchCombos();
    return () => {
      cancelled = true;
    };
  }, [sort]);

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
                c._id === comboId
                  ? { ...c, savedByMe: data.data.saved, saveCount: data.data.saveCount }
                  : c
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

  const visibleCombos = combos
    ? combos.filter((c) => comboMatchesType(c.gearType, typeFilter))
    : null;

  function handleRegisterClick() {
    router.push(status === 'authenticated' ? '/combo/new' : '/auth/signin');
  }

  function resetFilters() {
    setTypeFilter('all');
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
            className={`h-8 whitespace-nowrap rounded px-3 text-sm transition-colors ${
              sort === value
                ? 'bg-background font-semibold text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
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
            onClick={() => setTypeFilter(f.value)}
            aria-pressed={typeFilter === f.value}
            className={`h-8 whitespace-nowrap rounded px-3 text-sm transition-colors ${
              typeFilter === f.value
                ? 'bg-background font-semibold text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
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
        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-4 text-destructive">{error}</div>
        )}

        {combos === null && !error && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[repeat(auto-fill,minmax(340px,1fr))] md:gap-4">
            {[0, 1, 2, 3].map((i) => (
              <ComboCardSkeleton key={i} />
            ))}
          </div>
        )}

        {combos && combos.length === 0 && (
          <p className="text-muted-foreground">등록된 콤보가 없어요. 첫 콤보를 등록해보세요.</p>
        )}

        {combos && combos.length > 0 && visibleCombos && visibleCombos.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
            <p className="text-muted-foreground">조건에 맞는 콤보가 없어요</p>
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
