'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/technique-request-format';

interface LinkedItem {
  _id: string;
  name: { ko: string };
  slug: string;
  pathSlugs?: string[];
}

interface RelatedTechnique {
  _id: string;
  name: string;
  href: string;
  primaryRole: string;
  thumbnailUrl: string | null;
}

interface RelatedData {
  siblings: RelatedTechnique[];
  prev: RelatedTechnique | null;
  next: RelatedTechnique | null;
  combos: Array<{ _id: string; name: string; length: number; saveCount: number }>;
}

interface TechniqueRelatedSectionsProps {
  techniqueId: string;
  sweeps?: LinkedItem[];
  submissions?: LinkedItem[];
  escapes?: LinkedItem[];
}

const hrefOf = (t: LinkedItem) => `/technique/${[...(t.pathSlugs || []), t.slug].join('/')}`;

// 상세 페이지 하단: 이어지는 기술 / 같은 계열 기술 / 포함된 콤보 / 이전·다음 형제.
export function TechniqueRelatedSections({
  techniqueId,
  sweeps = [],
  submissions = [],
  escapes = [],
}: TechniqueRelatedSectionsProps) {
  // 어느 기술의 데이터인지 함께 저장해, 다른 기술로 이동했을 때 이전 기술의 목록이 잠깐 보이지 않게 한다.
  const [loaded, setLoaded] = useState<{ id: string; data: RelatedData } | null>(null);
  const related = loaded?.id === techniqueId ? loaded.data : null;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/techniques/${techniqueId}/related`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.success) setLoaded({ id: techniqueId, data: data.data });
      })
      .catch(() => {
        // 부가 정보이므로 실패해도 본문 표시에는 영향이 없다.
      });
    return () => {
      cancelled = true;
    };
  }, [techniqueId]);

  const linkedGroups = [
    { label: '스윕', items: sweeps },
    { label: '서브미션', items: submissions },
    { label: '이스케이프', items: escapes },
  ].filter((g) => g.items.length > 0);

  return (
    <>
      {linkedGroups.length > 0 && (
        <section className="pt-6 border-t border-border">
          <h2 className="text-2xl font-semibold mb-4">여기서 이어지는 기술</h2>
          <div className="space-y-3">
            {linkedGroups.map((group) => (
              <div key={group.label} className="flex flex-wrap items-center gap-2">
                <span className="w-20 shrink-0 text-sm font-medium text-muted-foreground">{group.label}</span>
                {group.items.map((item) => (
                  <Link
                    key={item._id}
                    href={hrefOf(item)}
                    className="rounded-full border border-border px-3 py-1 text-sm hover:bg-accent hover:border-primary/50 transition-colors"
                  >
                    {item.name.ko}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {related && related.siblings.length > 0 && (
        <section className="pt-6 border-t border-border">
          <h2 className="text-2xl font-semibold mb-4">같은 계열 기술</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {related.siblings.map((s) => (
              <Link
                key={s._id}
                href={s.href}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-accent hover:border-primary/50 transition-all"
              >
                {s.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.thumbnailUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{s.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {ROLE_LABELS[s.primaryRole] || s.primaryRole}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {related && related.combos.length > 0 && (
        <section className="pt-6 border-t border-border">
          <h2 className="text-2xl font-semibold mb-4">이 기술이 포함된 콤보</h2>
          <ul className="space-y-2">
            {related.combos.map((c) => (
              <li key={c._id}>
                <Link
                  href={`/combo/${c._id}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:bg-accent hover:border-primary/50 transition-all"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {c.length}단계{c.saveCount > 0 && ` · 저장 ${c.saveCount}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {related && (related.prev || related.next) && (
        <nav className="grid grid-cols-2 gap-3 pt-6 border-t border-border" aria-label="이전/다음 기술">
          {related.prev ? (
            <Link
              href={related.prev.href}
              className="flex items-center gap-2 rounded-lg border border-border p-3 hover:bg-accent transition-colors"
            >
              <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">이전</div>
                <div className="truncate text-sm font-semibold">{related.prev.name}</div>
              </div>
            </Link>
          ) : (
            <span />
          )}
          {related.next ? (
            <Link
              href={related.next.href}
              className="flex items-center justify-end gap-2 rounded-lg border border-border p-3 text-right hover:bg-accent transition-colors"
            >
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">다음</div>
                <div className="truncate text-sm font-semibold">{related.next.name}</div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
