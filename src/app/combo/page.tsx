'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Bookmark, Plus } from 'lucide-react';

interface ComboTechnique {
  _id: string;
  name: { ko: string; en?: string };
  slug: string;
  pathSlugs: string[];
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

function chainSummary(techniques: ComboTechnique[]) {
  return techniques.map((t) => t.name.ko).join(' → ');
}

export default function ComboListPage() {
  const router = useRouter();
  const { status } = useSession();
  const [combos, setCombos] = useState<ComboListItem[] | null>(null);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<SortOption>('popular');
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

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setSort('popular')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            sort === 'popular'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          인기순
        </button>
        <button
          onClick={() => setSort('recent')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            sort === 'recent'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          최신순
        </button>
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

      {combos && combos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {combos.map((combo) => (
            <Link
              key={combo._id}
              href={`/combo/${combo._id}`}
              className="block rounded-lg border p-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{combo.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{chainSummary(combo.techniques)}</p>
                  <p className="text-xs text-muted-foreground mt-2">by {combo.createdBy?.nickname}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSave(combo._id);
                  }}
                  disabled={savingId === combo._id}
                  aria-label="콤보 저장"
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-sm transition-colors ${
                    combo.savedByMe ? 'text-accent' : 'text-muted-foreground hover:text-accent'
                  }`}
                >
                  <Bookmark className={`h-4 w-4 ${combo.savedByMe ? 'fill-current' : ''}`} />
                  {combo.saveCount}
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
