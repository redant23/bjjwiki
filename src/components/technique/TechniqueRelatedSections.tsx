'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

interface FollowingItem {
  _id: string;
  name: string;
  href: string;
  count: number;
}

interface RelatedData {
  following: FollowingItem[];
  prev: RelatedTechnique | null;
  next: RelatedTechnique | null;
  combos: Array<{ _id: string; name: string; length: number; saveCount: number }>;
}

interface TechniqueRelatedSectionsProps {
  techniqueId: string;
  // 작성자가 제목을 짓고 기술을 골라 넣은 연결 목록
  groups?: Array<{ title: string; techniques: LinkedItem[] }>;
}

const hrefOf = (t: LinkedItem) => `/technique/${[...(t.pathSlugs || []), t.slug].join('/')}`;

// 상세 페이지 하단: 콤보 기반 이어지는 기술 / 작성자가 만든 제목별 연결 목록 / 포함된 콤보 / 이전·다음 형제.
export function TechniqueRelatedSections({
  techniqueId,
  groups = [],
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

  return (
    <>
      {related && related.following.length > 0 && (
        <section className="pt-6 border-t border-border">
          <h2 className="text-2xl font-semibold">여기서 이어지는 기술</h2>
          <p className="mb-4 text-sm text-muted-foreground">콤보에 등록된 연결을 기준으로 보여줍니다.</p>
          <div className="flex flex-wrap gap-2">
            {related.following.map((item) => (
              <Link
                key={item._id}
                href={item.href}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm hover:bg-accent hover:border-primary/50 transition-colors"
              >
                {item.name}
                <span className="text-xs text-muted-foreground">콤보 {item.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {groups
        .filter((g) => g.title && g.techniques.length > 0)
        .map((group) => (
          <section key={group.title} className="pt-6 border-t border-border">
            <h2 className="text-2xl font-semibold mb-4">{group.title}</h2>
            <div className="flex flex-wrap gap-2">
              {group.techniques.map((item) => (
                <Link
                  key={item._id}
                  href={hrefOf(item)}
                  className="rounded-full border border-border px-3 py-1 text-sm hover:bg-accent hover:border-primary/50 transition-colors"
                >
                  {item.name.ko}
                </Link>
              ))}
            </div>
          </section>
        ))}

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
