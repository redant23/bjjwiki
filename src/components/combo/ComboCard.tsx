'use client';

import Link from 'next/link';
import { Bookmark, Play } from 'lucide-react';
import { getYoutubeThumbnailUrl } from '@/lib/youtube';
import {
  comboBadgeKind,
  comboBadgeLabel,
  comboDisplayTitle,
  type ComboBadgeKind,
  type ComboGearType,
} from '@/lib/combo-type';
import { ComboChips } from '@/components/combo/ComboChips';

export interface ComboTechnique {
  _id: string;
  name: { ko: string; en?: string };
  slug: string;
  pathSlugs: string[];
}

export interface ComboListItem {
  _id: string;
  name: string;
  techniques: ComboTechnique[];
  gearType?: ComboGearType;
  videoUrl?: string;
  photoUrl?: string;
  createdBy: { _id: string; nickname: string };
  saveCount: number;
  savedByMe?: boolean;
}

// 배지·띠 색: 기=파랑, 노기=주황, 기/노기·미지정=회색. 글자는 라이트/다크 모두 AA(4.5:1) 이상.
const BADGE_STYLES: Record<ComboBadgeKind, { badge: string; strip: string }> = {
  gi: {
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
    strip: 'bg-blue-500',
  },
  nogi: {
    badge: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200',
    strip: 'bg-orange-500',
  },
  both: {
    badge: 'bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200',
    strip: 'bg-zinc-400',
  },
  unknown: {
    badge: 'bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200',
    strip: 'bg-zinc-400',
  },
};

const ADMIN_NICKNAME = '관리자';

function comboThumbnail(combo: ComboListItem): string | null {
  return combo.photoUrl || (combo.videoUrl ? getYoutubeThumbnailUrl(combo.videoUrl) : null);
}

interface ComboCardProps {
  combo: ComboListItem;
  saving: boolean;
  onToggleSave: (comboId: string) => void;
}

export function ComboCard({ combo, saving, onToggleSave }: ComboCardProps) {
  const thumbnail = comboThumbnail(combo);
  const kind = comboBadgeKind(combo.gearType, combo.name);
  const style = BADGE_STYLES[kind];
  const author = combo.createdBy?.nickname;
  const showAuthor = !!author && author !== ADMIN_NICKNAME;

  return (
    <article className="relative flex h-full gap-3 overflow-hidden rounded-lg border bg-card p-3 pl-4 transition-colors hover:bg-muted/30">
      <span className={`absolute inset-y-0 left-0 w-0.5 ${style.strip}`} aria-hidden="true" />

      {thumbnail && (
        <div className="relative aspect-[16/10] w-24 shrink-0 self-start overflow-hidden rounded-md bg-muted md:w-[120px]">
          <img src={thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
          {combo.videoUrl && (
            <span
              className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white"
              aria-label="영상 있음"
            >
              <Play className="h-3 w-3 fill-current" aria-hidden="true" />
            </span>
          )}
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug tracking-normal [overflow-wrap:anywhere] [word-break:keep-all] md:text-[17px]">
          <Link href={`/combo/${combo._id}`} className="after:absolute after:inset-0">
            {comboDisplayTitle(combo.name)}
          </Link>
        </h3>

        <ComboChips names={combo.techniques.map((t) => t.name.ko)} />

        <div className="mt-auto flex items-center justify-between gap-2 text-xs text-muted-foreground md:text-[13px]">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${style.badge}`}>
              {comboBadgeLabel(kind)}
            </span>
            {showAuthor && <span className="truncate">by {author}</span>}
          </div>
          <button
            type="button"
            onClick={() => onToggleSave(combo._id)}
            disabled={saving}
            aria-label={combo.savedByMe ? '콤보 저장 취소' : '콤보 저장'}
            aria-pressed={!!combo.savedByMe}
            className={`relative z-10 -my-3 -mr-3 flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-md px-2 transition-colors ${
              combo.savedByMe
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Bookmark className={`h-4 w-4 ${combo.savedByMe ? 'fill-current' : ''}`} />
            <span className="tabular-nums">{combo.saveCount}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

export function ComboCardSkeleton() {
  return (
    <div className="flex h-[132px] gap-3 rounded-lg border p-3 pl-4" aria-hidden="true">
      <div className="aspect-[16/10] w-24 shrink-0 animate-pulse self-start rounded-md bg-muted md:w-[120px]" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-5 w-4/5 animate-pulse rounded bg-muted" />
        <div className="h-7 w-full animate-pulse rounded-full bg-muted" />
        <div className="mt-auto h-4 w-1/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
