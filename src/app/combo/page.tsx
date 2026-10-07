'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Bookmark, Layers, Plus, Video } from 'lucide-react';
import { getYoutubeThumbnailUrl } from '@/lib/youtube';
import { comboMatchesType, comboTypeInfo, comboTypeLabel, type ComboTypeFilter } from '@/lib/combo-type';

interface ComboTechnique {
  _id: string;
  name: { ko: string; en?: string };
  slug: string;
  pathSlugs: string[];
  type?: string;
}

interface ComboListItem {
  _id: string;
  name: string;
  techniques: ComboTechnique[];
  videoUrl?: string;
  photoUrl?: string;
  createdBy: { _id: string; nickname: string };
  saveCount: number;
  savedByMe?: boolean;
}

type SortOption = 'popular' | 'recent';

function techniqueHref(technique: ComboTechnique) {
  return `/technique/${[...(technique.pathSlugs || []), technique.slug].join('/')}`;
}

// 썸네일: 직접 올린 사진이 우선, 없으면 유튜브 영상 썸네일. 둘 다 없으면 null.
function comboThumbnail(combo: ComboListItem): string | null {
  return combo.photoUrl || (combo.videoUrl ? getYoutubeThumbnailUrl(combo.videoUrl) : null);
}

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
    ? combos.filter((c) =>
        comboMatchesType(comboTypeInfo(c.techniques.map((t) => t.type ?? '')), typeFilter)
      )
    : null;

  function handleRegisterClick() {
    router.push(status === 'authenticated' ? '/combo/new' : '/auth/signin');
  }

  return (
    <div className="container max-w-4xl py-6 lg:py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">콤보</h1>
        <button
          onClick={handleRegisterClick}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          콤보 등록
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex gap-2">
          {([['popular', '인기순'], ['recent', '최신순']] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setSort(value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                sort === value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2" role="group" aria-label="기/노기 필터">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              aria-pressed={typeFilter === f.value}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                typeFilter === f.value
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-input text-muted-foreground hover:bg-muted/50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-md mb-6">
          {error}
        </div>
      )}

      {combos === null && !error && <div className="text-muted-foreground">불러오는 중...</div>}

      {combos && combos.length === 0 && (
        <p className="text-muted-foreground">등록된 콤보가 없습니다. 첫 콤보를 등록해보세요.</p>
      )}

      {combos && combos.length > 0 && visibleCombos && visibleCombos.length === 0 && (
        <p className="text-muted-foreground">해당 유형의 콤보가 없습니다.</p>
      )}

      {visibleCombos && visibleCombos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleCombos.map((combo) => {
            const thumbnail = comboThumbnail(combo);
            const typeLabel = comboTypeLabel(comboTypeInfo(combo.techniques.map((t) => t.type ?? '')));
            return (
              // 카드 전체를 누르면 콤보 상세로 가고(제목 링크를 카드 크기로 늘림), 체인의 기술 이름과
              // 저장 버튼은 그 위(z-10)에 올려 각각 따로 눌린다. 링크 안에 링크를 넣지 않기 위한 구조.
              <div
                key={combo._id}
                className="relative flex gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors"
              >
                {thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbnail} alt="" className="h-20 w-28 shrink-0 rounded-md object-cover" />
                ) : (
                  <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Layers className="h-6 w-6" aria-hidden="true" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">
                      <Link href={`/combo/${combo._id}`} className="after:absolute after:inset-0">
                        {combo.name}
                      </Link>
                    </h3>
                    <button
                      onClick={() => handleSave(combo._id)}
                      disabled={savingId === combo._id}
                      aria-label="콤보 저장"
                      className={`relative z-10 flex shrink-0 items-center gap-1 px-2 py-1 rounded-md text-sm transition-colors ${
                        combo.savedByMe ? 'text-accent' : 'text-muted-foreground hover:text-accent'
                      }`}
                    >
                      <Bookmark className={`h-4 w-4 ${combo.savedByMe ? 'fill-current' : ''}`} />
                      {combo.saveCount}
                    </button>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm">
                    {combo.techniques.map((technique, index) => (
                      <span key={technique._id} className="inline-flex items-center gap-1">
                        <Link
                          href={techniqueHref(technique)}
                          className="relative z-10 text-muted-foreground hover:text-foreground hover:underline"
                        >
                          {technique.name.ko}
                        </Link>
                        {index < combo.techniques.length - 1 && (
                          <span className="text-muted-foreground/60" aria-hidden="true">→</span>
                        )}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>by {combo.createdBy?.nickname}</span>
                    <span>· {typeLabel}</span>
                    {combo.videoUrl && (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Video className="h-3.5 w-3.5" />
                        영상
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
