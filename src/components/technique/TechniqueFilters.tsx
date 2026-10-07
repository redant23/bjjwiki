'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import {
  buildBrowseHref,
  DEFAULT_BROWSE_PARAMS,
  DIFFICULTY_BANDS,
  hasActiveFilters,
  type BrowseParams,
} from '@/lib/technique-browse';
import { PRIMARY_ROLE_OPTIONS } from '@/lib/technique-form';

interface TechniqueFiltersProps {
  params: BrowseParams;
}

const selectClass =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

// 필터 상태는 전부 주소에 담는다 (공유/뒤로가기 가능). 바꿀 때마다 1페이지로 돌아간다.
export function TechniqueFilters({ params }: TechniqueFiltersProps) {
  const router = useRouter();
  const [q, setQ] = useState(params.q);
  const lastSentQ = useRef(params.q);

  // 뒤로가기 등으로 주소의 검색어가 바뀌면 입력창도 맞춘다.
  useEffect(() => {
    setQ(params.q);
    lastSentQ.current = params.q;
  }, [params.q]);

  const apply = (overrides: Partial<BrowseParams>) => {
    router.replace(buildBrowseHref(params, { ...overrides, page: 1 }), { scroll: false });
  };

  // 타이핑은 잠깐 멈춘 뒤에 반영해 요청이 쏟아지지 않게 한다.
  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed === lastSentQ.current) return;
    const id = setTimeout(() => {
      lastSentQ.current = trimmed;
      router.replace(buildBrowseHref(params, { q: trimmed, page: 1 }), { scroll: false });
    }, 400);
    return () => clearTimeout(id);
    // params는 의도적으로 제외: 타이핑 중 다른 필터가 바뀌어도 타이머를 다시 걸 필요가 없다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="기술 이름 또는 별칭 검색"
          aria-label="기술 검색"
          className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <select
          aria-label="기/노기"
          className={selectClass}
          value={params.type ?? ''}
          onChange={(e) => apply({ type: (e.target.value || null) as BrowseParams['type'] })}
        >
          <option value="">기/노기 전체</option>
          <option value="gi">기 (도복)</option>
          <option value="nogi">노기</option>
        </select>
        <select
          aria-label="주 역할"
          className={selectClass}
          value={params.role ?? ''}
          onChange={(e) => apply({ role: e.target.value || null })}
        >
          <option value="">주 역할 전체</option>
          {PRIMARY_ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          aria-label="탑/바텀"
          className={selectClass}
          value={params.positionType ?? ''}
          onChange={(e) => apply({ positionType: (e.target.value || null) as BrowseParams['positionType'] })}
        >
          <option value="">탑/바텀 전체</option>
          <option value="top">탑</option>
          <option value="bottom">바텀</option>
        </select>
        <select
          aria-label="난이도"
          className={selectClass}
          value={params.difficulty ?? ''}
          onChange={(e) => apply({ difficulty: (e.target.value || null) as BrowseParams['difficulty'] })}
        >
          <option value="">난이도 전체</option>
          {Object.entries(DIFFICULTY_BANDS).map(([value, band]) => (
            <option key={value} value={value}>{band.label}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={params.hasVideo}
              onChange={(e) => apply({ hasVideo: e.target.checked })}
            />
            영상 있음
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={params.hasThumbnail}
              onChange={(e) => apply({ hasThumbnail: e.target.checked })}
            />
            썸네일 있음
          </label>
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters(params) && (
            <button
              type="button"
              onClick={() => {
                setQ('');
                lastSentQ.current = '';
                router.replace(buildBrowseHref(DEFAULT_BROWSE_PARAMS, { sort: params.sort }), { scroll: false });
              }}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-input px-3 text-sm hover:bg-muted/50"
            >
              <X className="h-3.5 w-3.5" />
              필터 초기화
            </button>
          )}
          <select
            aria-label="정렬"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={params.sort}
            onChange={(e) => apply({ sort: e.target.value as BrowseParams['sort'] })}
          >
            <option value="latest">최신순</option>
            <option value="name">이름순</option>
            <option value="popular">인기순</option>
          </select>
        </div>
      </div>
    </div>
  );
}
