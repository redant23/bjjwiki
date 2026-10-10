'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  buildSearchIndex,
  search,
  type SearchComboInput,
  type SearchTechniqueInput,
} from '@/lib/search';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchData {
  techniques: SearchTechniqueInput[];
  combos: SearchComboInput[];
}

interface FlatItem {
  key: string;
  href: string;
}

const DEBOUNCE_MS = 80;
const MAX_TECHNIQUES = 30;
const MAX_COMBOS = 10;

function techniqueHref(t: SearchTechniqueInput) {
  return `/technique/${[...(t.pathSlugs || []), t.slug].join('/')}`;
}

function comboHref(c: SearchComboInput) {
  return c.number ? `/combo/${c.number}` : `/combo/pending/${c._id}`;
}

const GEAR_LABEL: Record<string, string> = { gi: '기', nogi: '노기' };

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [data, setData] = useState<SearchData | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // 열 때마다 최신 목록을 받아온다. 받는 동안에는 이전 목록으로 바로 검색한다.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch('/api/search-index', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json.success) setData(json.data);
      })
      .catch((error) => console.error('Search index load failed:', error));
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQuery(query);
      setActiveIndex(0);
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const index = useMemo(
    () => (data ? buildSearchIndex(data.techniques, data.combos) : null),
    [data]
  );

  const results = useMemo(
    () => (index ? search(index, debouncedQuery) : { techniques: [], combos: [] }),
    [index, debouncedQuery]
  );

  const shownTechniques = results.techniques.slice(0, MAX_TECHNIQUES);
  const shownCombos = results.combos.slice(0, MAX_COMBOS);
  // 번호 질의("14번 콤보")로 걸린 콤보는 기술보다 위, 목록 맨 앞에 둔다.
  const comboFirst = !!shownCombos[0]?.byNumber;
  const techniqueItems: FlatItem[] = shownTechniques.map(({ technique }) => ({
    key: `t-${technique._id}`,
    href: techniqueHref(technique),
  }));
  const comboItems: FlatItem[] = shownCombos.map(({ combo }) => ({
    key: `c-${combo._id}`,
    href: comboHref(combo),
  }));
  const flatItems: FlatItem[] = comboFirst
    ? [...comboItems, ...techniqueItems]
    : [...techniqueItems, ...comboItems];
  const techniqueOffset = comboFirst ? shownCombos.length : 0;
  const comboOffset = comboFirst ? 0 : shownTechniques.length;

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleSelect = (path: string) => {
    onClose();
    router.push(path);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 한글 조합 중의 Enter/화살표는 IME가 처리하도록 둔다.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatItems.length) setActiveIndex((i) => (i + 1) % flatItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatItems.length) setActiveIndex((i) => (i - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // 디바운스가 끝나기 전에 Enter를 눌러도 지금 입력 기준 결과로 이동한다.
      if (query !== debouncedQuery && index) {
        const fresh = search(index, query);
        const first = fresh.combos[0]?.byNumber
          ? comboHref(fresh.combos[0].combo)
          : fresh.techniques[0]
            ? techniqueHref(fresh.techniques[0].technique)
            : fresh.combos[0] && comboHref(fresh.combos[0].combo);
        if (first) handleSelect(first);
        return;
      }
      const item = flatItems[activeIndex];
      if (item) handleSelect(item.href);
    }
  };

  if (!isOpen) return null;

  const loading = !data;
  const hasQuery = !!query.trim();
  const hasResults = flatItems.length > 0;
  const itemClass = (i: number) =>
    `w-full flex items-center px-4 py-3 text-left rounded-md group transition-colors ${
      i === activeIndex ? 'bg-muted/50' : 'hover:bg-muted/50'
    }`;
  const nameClass = (i: number) =>
    `font-medium transition-colors group-hover:text-primary ${i === activeIndex ? 'text-primary' : 'text-foreground'}`;

  const comboBlock = shownCombos.length > 0 && (
                <div className="space-y-1">
                  <div className="px-4 pt-1 text-xs font-semibold text-muted-foreground">콤보</div>
                  {shownCombos.map(({ combo, chain, matchedTechnique, matchedPerformer, byNumber }, j) => {
                    const i = comboOffset + j;
                    return (
                      <button
                        key={combo._id}
                        data-index={i}
                        role="option"
                        aria-selected={i === activeIndex}
                        onMouseMove={() => setActiveIndex(i)}
                        onClick={() => handleSelect(comboHref(combo))}
                        className={itemClass(i)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className={nameClass(i)}>
                            <span className="mr-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                              {combo.number ? `#${combo.number}` : '승인 대기'}
                            </span>
                            {chain.join(' → ')}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {byNumber
                              ? `${combo.number}번 콤보`
                              : matchedPerformer
                                ? `시전자: ${matchedPerformer}`
                                : matchedTechnique
                                  ? `포함 기술: ${matchedTechnique}`
                                  : `기술 ${combo.techniques.length}개`}
                          </div>
                        </div>
                        {(combo.gearTypes ?? []).map((g) => (
                          <span key={g} className="bg-muted px-1.5 py-0.5 rounded text-[10px] text-muted-foreground">
                            {GEAR_LABEL[g] ?? g}
                          </span>
                        ))}
                      </button>
                    );
                  })}
                </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl bg-background rounded-lg shadow-2xl border border-border overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center px-4 py-3 border-b border-border">
          <Search className="h-5 w-5 text-muted-foreground mr-3" />
          <input
            ref={inputRef}
            type="text"
            placeholder="기술·콤보 검색..."
            className="flex-1 bg-transparent border-none outline-none text-lg placeholder:text-muted-foreground"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            role="combobox"
            aria-expanded={hasResults}
            aria-controls="search-results"
          />
          {loading ? (
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          ) : (
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
        </div>

        <div ref={listRef} id="search-results" role="listbox" className="overflow-y-auto p-2">
          {hasResults ? (
            <div className="space-y-3">
              {comboFirst && comboBlock}
              {shownTechniques.length > 0 && (
                <div className="space-y-1">
                  <div className="px-4 pt-1 text-xs font-semibold text-muted-foreground">기술</div>
                  {shownTechniques.map(({ technique }, idx) => {
                    const i = techniqueOffset + idx;
                    return (
                    <button
                      key={technique._id}
                      data-index={i}
                      role="option"
                      aria-selected={i === activeIndex}
                      onMouseMove={() => setActiveIndex(i)}
                      onClick={() => handleSelect(techniqueHref(technique))}
                      className={itemClass(i)}
                    >
                      <div className="flex-1">
                        <div className={nameClass(i)}>{technique.name.ko}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {technique.name.en && <span className="mr-2">{technique.name.en}</span>}
                          <span className="capitalize bg-muted px-1.5 py-0.5 rounded text-[10px]">
                            {technique.primaryRole}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Level {(technique.pathSlugs?.length ?? 0) + 1}
                      </div>
                    </button>
                    );
                  })}
                </div>
              )}

              {!comboFirst && comboBlock}
            </div>
          ) : hasQuery ? (
            <div className="py-12 text-center text-muted-foreground">
              {!loading && '검색 결과가 없습니다.'}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              기술이나 콤보 이름을 입력하세요.
            </div>
          )}
        </div>

        <div className="px-4 py-2 bg-muted/30 border-t border-border text-xs text-muted-foreground flex justify-between">
          <span>
            기술 <strong>{results.techniques.length}</strong> · 콤보 <strong>{results.combos.length}</strong>
          </span>
          <span className="hidden sm:inline">↑↓ 이동 · Enter 열기 · ESC 닫기</span>
          <span className="sm:hidden">ESC to close</span>
        </div>
      </div>
    </div>
  );
}
