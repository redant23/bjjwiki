'use client';

import Link from 'next/link';
import { Bookmark, Clock, Play } from 'lucide-react';
import { getYoutubeThumbnailUrl } from '@/lib/youtube';
import { summarizeDemos } from '@/lib/combo-chain';
import { ComboChips } from '@/components/combo/ComboChips';

export interface ComboTechnique {
  _id: string;
  name: { ko: string; en?: string };
  slug: string;
  pathSlugs: string[];
}

export interface ComboDemoItem {
  _id: string;
  performer?: string;
  videoUrl?: string;
  gearType: 'gi' | 'nogi' | 'unknown';
  createdBy?: { _id: string; nickname: string } | null;
  createdAt?: string;
}

export interface ComboListItem {
  _id: string;
  number: number | null;
  status: 'pending' | 'published' | 'rejected';
  techniques: ComboTechnique[];
  demos: ComboDemoItem[];
  createdBy: { _id: string; nickname: string } | null;
  saveCount: number;
  savedByMe?: boolean;
  isMine?: boolean;
  publishedAt?: string;
  createdAt?: string;
}

export function comboHref(combo: Pick<ComboListItem, '_id' | 'number' | 'status'>): string {
  return combo.number && combo.status !== 'pending'
    ? `/combo/${combo.number}`
    : `/combo/pending/${combo._id}`;
}

// 배지 색: 기=파랑, 노기=주황. 글자는 라이트/다크 모두 AA(4.5:1) 이상.
export const GEAR_BADGE: Record<'gi' | 'nogi', { label: string; className: string }> = {
  gi: { label: '기', className: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' },
  nogi: { label: '노기', className: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200' },
};

function stripColor(gears: Array<'gi' | 'nogi'>): string {
  if (gears.length === 1) return gears[0] === 'gi' ? 'bg-blue-500' : 'bg-orange-500';
  return 'bg-zinc-400';
}

interface ComboCardProps {
  combo: ComboListItem;
  saving: boolean;
  onToggleSave: (comboId: string) => void;
}

export function ComboCard({ combo, saving, onToggleSave }: ComboCardProps) {
  const pending = combo.status === 'pending';
  const summary = summarizeDemos(combo.demos);
  // 썸네일: 영상이 있는 첫 시연의 유튜브 썸네일. 하나도 없으면 영역 자체를 두지 않는다.
  const thumbnail =
    combo.demos.map((d) => (d.videoUrl ? getYoutubeThumbnailUrl(d.videoUrl) : null)).find(Boolean) ?? null;
  const label = pending ? '승인 대기 중인 콤보' : `${combo.number}번 콤보`;

  return (
    <article
      className={`relative flex h-full flex-col gap-3 overflow-hidden rounded-lg border bg-card p-3 pl-4 transition-colors hover:bg-muted/30 ${
        pending ? 'opacity-70' : ''
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-0.5 ${stripColor(summary.gearTypes)}`} aria-hidden="true" />

      {pending ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <Link
            href={comboHref(combo)}
            aria-label={label}
            className="after:absolute after:inset-0 inline-flex h-[30px] shrink-0 items-center gap-1 rounded-md bg-amber-100 px-2 text-sm font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200 md:text-[15px]"
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            승인 대기
          </Link>
          <span className="text-xs text-muted-foreground md:text-[13px]">번호는 승인 후 부여</span>
          <ComboChips
            className="w-full"
            items={combo.techniques.map((t) => ({ name: t.name.ko }))}
          />
        </div>
      ) : (
        <div className="flex items-start gap-x-2">
          <Link
            href={comboHref(combo)}
            aria-label={label}
            className="after:absolute after:inset-0 inline-flex h-[30px] shrink-0 items-center rounded-md bg-primary/10 px-2 text-sm font-bold tabular-nums text-primary md:text-[15px]"
          >
            #{combo.number}
          </Link>
          <ComboChips
            className="min-w-0 flex-1"
            items={combo.techniques.map((t) => ({ name: t.name.ko }))}
          />
        </div>
      )}

      <div className="flex items-start gap-3">
        {thumbnail && (
          <div className="relative aspect-[16/10] w-24 shrink-0 overflow-hidden rounded-md bg-muted md:w-[120px]">
            <img src={thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
            <span
              className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white"
              aria-label="영상 있음"
            >
              <Play className="h-3 w-3 fill-current" aria-hidden="true" />
            </span>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs text-muted-foreground md:text-[13px]">
          {summary.performerLine && (
            <p className="truncate text-sm font-medium text-foreground md:text-[15px]">
              <span aria-hidden="true">👤 </span>
              {summary.performerLine}
            </p>
          )}
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {summary.gearTypes.map((g) => (
              <span
                key={g}
                className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${GEAR_BADGE[g].className}`}
              >
                {GEAR_BADGE[g].label}
              </span>
            ))}
            {summary.videoCount > 0 && <span className="shrink-0">▶ 시연 {summary.videoCount}개</span>}
          </div>
        </div>

        {!pending && (
          <button
            type="button"
            onClick={() => onToggleSave(combo._id)}
            disabled={saving}
            aria-label={combo.savedByMe ? '콤보 저장 취소' : '콤보 저장'}
            aria-pressed={!!combo.savedByMe}
            className={`relative z-10 -my-1 -mr-2 flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-md px-2 text-xs transition-colors md:text-[13px] ${
              combo.savedByMe
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Bookmark className={`h-4 w-4 ${combo.savedByMe ? 'fill-current' : ''}`} />
            <span className="tabular-nums">{combo.saveCount}</span>
          </button>
        )}
      </div>
    </article>
  );
}

export function ComboCardSkeleton() {
  return (
    <div className="flex h-[132px] flex-col gap-3 rounded-lg border p-3 pl-4" aria-hidden="true">
      <div className="h-[30px] w-4/5 animate-pulse rounded-full bg-muted" />
      <div className="flex gap-3">
        <div className="aspect-[16/10] w-24 shrink-0 animate-pulse rounded-md bg-muted md:w-[120px]" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
