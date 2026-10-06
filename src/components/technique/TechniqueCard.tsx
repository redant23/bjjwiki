import Link from 'next/link';
import { Video } from 'lucide-react';
import type { TechniqueCardData } from '@/lib/technique-card-data';
import { ROLE_LABELS } from '@/lib/technique-request-format';
import { categoryIconKey } from '@/lib/technique-cards';
import { CATEGORY_ICONS } from '@/components/technique/category-icons';

// 썸네일이 있으면 이미지, 없으면 루트 분류 아이콘.
export function CardThumb({ card, className }: { card: TechniqueCardData; className: string }) {
  if (card.thumbnailUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={card.thumbnailUrl} alt="" className={`${className} object-cover`} />;
  }
  const Icon = CATEGORY_ICONS[categoryIconKey(card.rootName)];
  return (
    <div className={`${className} flex items-center justify-center bg-muted text-muted-foreground`}>
      <Icon className="h-1/3 w-1/3" aria-hidden="true" />
    </div>
  );
}

// 그리드용 썸네일 카드 (홈 "최근 추가", 필터 탐색 페이지에서 공용).
export function TechniqueCard({ card, showSummary = false }: { card: TechniqueCardData; showSummary?: boolean }) {
  return (
    <Link
      href={card.href}
      className="group overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/50 hover:shadow-md"
    >
      <CardThumb card={card} className="aspect-video w-full" />
      <div className="p-3">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold">{card.name}</span>
          {card.hasVideo && <Video className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="영상 있음" />}
        </div>
        <div className="text-xs text-muted-foreground">{ROLE_LABELS[card.primaryRole] || card.primaryRole}</div>
        {showSummary && card.summary && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{card.summary}</p>
        )}
      </div>
    </Link>
  );
}
