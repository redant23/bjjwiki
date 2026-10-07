'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Video, type LucideIcon } from 'lucide-react';
import { ROLE_LABELS, TYPE_LABELS } from '@/lib/technique-request-format';
import { categoryIconKey, groupCardsByRole } from '@/lib/technique-cards';
import { CATEGORY_ICONS } from '@/components/technique/category-icons';

interface Card {
  _id: string;
  name: string;
  href: string;
  type: string;
  primaryRole: string;
  thumbnailUrl: string | null;
  summary: string;
  childCount: number;
  hasVideo: boolean;
}

// API 응답 전에 보여줄 기본 정보 (기존 하위 기술 목록)
interface BasicChild {
  _id: string;
  name: { ko: string };
  slug: string;
  type: string;
  primaryRole: string;
}

interface ChildTechniqueCardsProps {
  techniqueId: string;
  basePath: string[]; // 부모의 [...pathSlugs, slug]
  basicChildren: BasicChild[];
}

function CardLink({ card, Icon }: { card: Card; Icon: LucideIcon }) {
  return (
    <Link
      href={card.href}
      className="flex gap-3 rounded-lg border border-border bg-card p-3 hover:bg-accent hover:border-primary/50 transition-all"
    >
      {card.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.thumbnailUrl} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold text-foreground">{card.name}</span>
          {card.hasVideo && <Video className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="영상 있음" />}
        </div>
        {card.summary && (
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{card.summary}</p>
        )}
        <div className="mt-1 text-xs text-muted-foreground">
          {ROLE_LABELS[card.primaryRole] || card.primaryRole} • {TYPE_LABELS[card.type] || card.type}
          {card.childCount > 0 && ` • 하위 ${card.childCount}개`}
        </div>
      </div>
    </Link>
  );
}

export function ChildTechniqueCards({ techniqueId, basePath, basicChildren }: ChildTechniqueCardsProps) {
  const [loaded, setLoaded] = useState<{ id: string; rootName: string; cards: Card[] } | null>(null);
  const data = loaded?.id === techniqueId ? loaded : null;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/techniques/${techniqueId}/child-cards`)
      .then((res) => res.json())
      .then((res) => {
        if (!cancelled && res.success) setLoaded({ id: techniqueId, ...res.data });
      })
      .catch(() => {
        // 실패하면 기본 정보 카드가 그대로 남는다.
      });
    return () => {
      cancelled = true;
    };
  }, [techniqueId]);

  // 응답 전에는 이름/역할/유형만 있는 기존 형태로 먼저 보여준다.
  const cards: Card[] =
    data?.cards ??
    basicChildren.map((c) => ({
      _id: c._id,
      name: c.name.ko,
      href: `/technique/${[...basePath, c.slug].join('/')}`,
      type: c.type,
      primaryRole: c.primaryRole,
      thumbnailUrl: null,
      summary: '',
      childCount: 0,
      hasVideo: false,
    }));
  const Icon = CATEGORY_ICONS[categoryIconKey(data?.rootName)];
  const groups = groupCardsByRole(cards);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.role ?? 'all'} className="space-y-3">
          {group.role && (
            <h3 className="text-sm font-semibold text-muted-foreground">
              {ROLE_LABELS[group.role] || group.role} · {group.items.length}
            </h3>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {group.items.map((card) => (
              <CardLink key={card._id} card={card} Icon={Icon} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
