import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TechniqueCard } from '@/components/technique/TechniqueCard';
import { TechniqueFilters } from '@/components/technique/TechniqueFilters';
import { browseTechniques } from '@/lib/browse-service';
import { buildBrowseHref, parseBrowseParams } from '@/lib/technique-browse';

export const metadata: Metadata = {
  title: '기술 탐색 | 오쓰그라운드',
  description: '유형, 주 역할, 난이도 등으로 주짓수 기술을 필터링해서 찾아보세요.',
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function TechniquesPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const params = parseBrowseParams((key) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  });
  const result = await browseTechniques(params);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">기술 탐색</h1>
        <p className="text-sm text-muted-foreground">
          조건을 골라 기술을 찾아보세요. 총 <span className="font-medium text-foreground">{result.total}</span>개
        </p>
      </div>

      <TechniqueFilters params={params} />

      {result.items.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">조건에 맞는 기술이 없습니다. 필터를 줄여 보세요.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {result.items.map((card) => (
            <TechniqueCard key={card._id} card={card} showSummary />
          ))}
        </div>
      )}

      {result.pageCount > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label="페이지 이동">
          {result.page > 1 ? (
            <Link
              href={buildBrowseHref(params, { page: result.page - 1 })}
              className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm hover:bg-muted/50"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              이전
            </Link>
          ) : (
            <span className="inline-flex h-9 items-center px-3 text-sm text-muted-foreground/50">
              <ChevronLeft className="mr-1 h-4 w-4" />
              이전
            </span>
          )}
          <span className="text-sm text-muted-foreground">
            {result.page} / {result.pageCount}
          </span>
          {result.page < result.pageCount ? (
            <Link
              href={buildBrowseHref(params, { page: result.page + 1 })}
              className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm hover:bg-muted/50"
            >
              다음
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          ) : (
            <span className="inline-flex h-9 items-center px-3 text-sm text-muted-foreground/50">
              다음
              <ChevronRight className="ml-1 h-4 w-4" />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
