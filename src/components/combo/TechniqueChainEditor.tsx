'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Search, X } from 'lucide-react';
import { buildSearchIndex, search, type SearchTechniqueInput } from '@/lib/search';

export interface ChainItem {
  _id: string;
  name: { ko: string; en?: string };
}

interface TechniqueChainEditorProps {
  chain: ChainItem[];
  onChange: (chain: ChainItem[]) => void;
  disabled?: boolean;
}

let techniquesCache: SearchTechniqueInput[] | null = null;

/** 기술 검색으로 순서 있는 체인을 만든다. 같은 기술을 여러 번 넣을 수 있다. ⌘K와 같은 검색 로직을 쓴다. */
export function TechniqueChainEditor({ chain, onChange, disabled }: TechniqueChainEditorProps) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [techniques, setTechniques] = useState<SearchTechniqueInput[] | null>(techniquesCache);

  useEffect(() => {
    if (techniquesCache) return;
    fetch('/api/search-index', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          techniquesCache = json.data.techniques;
          setTechniques(json.data.techniques);
        }
      })
      .catch((error) => console.error('Failed to load techniques:', error));
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 80);
    return () => clearTimeout(id);
  }, [query]);

  const index = useMemo(() => (techniques ? buildSearchIndex(techniques) : null), [techniques]);
  const results = useMemo(
    () =>
      index && query.trim()
        ? search(index, debounced).techniques.slice(0, 30).map((h) => h.technique)
        : [],
    [index, debounced, query]
  );

  function add(result: SearchTechniqueInput) {
    onChange([...chain, { _id: result._id, name: result.name }]);
    setQuery('');
    setDebounced('');
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= chain.length) return;
    const next = [...chain];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div>
      {chain.length > 0 && (
        <ul className="mb-3 space-y-2">
          {chain.map((item, i) => (
            <li key={`${item._id}-${i}`} className="flex items-center justify-between rounded-md border p-3">
              <span>
                <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                {item.name.ko}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={disabled || i === 0}
                  onClick={() => move(i, -1)}
                  aria-label="위로"
                  className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={disabled || i === chain.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label="아래로"
                  className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(chain.filter((_, k) => k !== i))}
                  aria-label="삭제"
                  className="rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-30"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {chain.length < 2 && (
        <p className="mb-3 text-sm text-muted-foreground">
          기술을 최소 2개 이상 추가해야 합니다. (현재 {chain.length}개)
        </p>
      )}

      <div className="relative">
        <div className="flex items-center rounded-md border px-3">
          <Search className="mr-2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            disabled={disabled}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="기술 검색 후 추가..."
            className="flex-1 bg-transparent py-2 text-sm outline-none"
          />
          {!!query.trim() && !techniques && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {results.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-background shadow-lg">
            {results.map((result) => (
              <li key={result._id}>
                <button
                  type="button"
                  onClick={() => add(result)}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-muted/50"
                >
                  {result.name.ko}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
