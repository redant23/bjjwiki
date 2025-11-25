'use client';

import { useParams } from 'next/navigation';
import { CATEGORY_DESCRIPTIONS } from '@/lib/categoryData';
import { useEffect, useState } from 'react';
import { Breadcrumb } from '@/components/ui/Breadcrumb';

interface Technique {
  _id: string;
  name: string;
  description: string;
  main_category: string;
  sub_category?: string;
  detail_category?: string;
}

export default function CategoryPage() {
  const params = useParams();
  const categoryPath = decodeURIComponent(params.category as string);
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [loading, setLoading] = useState(true);

  // categoryPath 형식: "가드" 또는 "가드::클로즈드 가드" 또는 "가드::하프 가드::딥 하프 가드"
  const parts = categoryPath.split('::');
  const mainCategory = parts[0];
  const subCategory = parts[1];
  const detailCategory = parts[2];

  const categoryInfo = CATEGORY_DESCRIPTIONS[categoryPath];

  // Breadcrumb 아이템 생성
  const breadcrumbItems = [];
  if (mainCategory) {
    breadcrumbItems.push({
      label: mainCategory,
      href: `/category/${encodeURIComponent(mainCategory)}`,
    });
  }
  if (subCategory) {
    breadcrumbItems.push({
      label: subCategory,
      href: `/category/${encodeURIComponent(mainCategory)}::${encodeURIComponent(subCategory)}`,
    });
  }
  if (detailCategory) {
    breadcrumbItems.push({
      label: detailCategory,
      href: `/category/${encodeURIComponent(mainCategory)}::${encodeURIComponent(subCategory)}::${encodeURIComponent(detailCategory)}`,
    });
  }

  useEffect(() => {
    async function fetchTechniques() {
      try {
        let url = '/api/techniques?';
        const params = new URLSearchParams();

        if (mainCategory) params.append('main_category', mainCategory);
        if (subCategory) params.append('sub_category', subCategory);
        if (detailCategory) params.append('detail_category', detailCategory);

        const res = await fetch(`${url}${params.toString()}`);
        const data = await res.json();

        if (data.success) {
          setTechniques(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch techniques', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTechniques();
  }, [mainCategory, subCategory, detailCategory]);

  if (!categoryInfo) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <Breadcrumb items={breadcrumbItems} />
        <div className="space-y-6">
          <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
            카테고리를 찾을 수 없습니다
          </h1>
          <p className="leading-7">
            요청하신 카테고리가 존재하지 않습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6">
      <Breadcrumb items={breadcrumbItems} />

      <div className="space-y-8">
        {/* 카테고리 헤더 */}
        <div className="space-y-4">
          <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
            {categoryInfo.name}
          </h1>
          <p className="text-lg leading-7 text-muted-foreground">
            {categoryInfo.description}
          </p>
        </div>

        {/* 핵심 포인트 */}
        {categoryInfo.keyPoints && categoryInfo.keyPoints.length > 0 && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-2xl font-semibold mb-4">핵심 포인트</h2>
            <ul className="space-y-2">
              {categoryInfo.keyPoints.map((point, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2 mt-1 text-primary">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 이 카테고리의 기술들 */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">
            {detailCategory ? '이 카테고리의 기술' : subCategory ? '하위 기술' : '주요 기술'}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({techniques.length}개)
            </span>
          </h2>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : techniques.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {techniques.map((technique) => (
                <a
                  key={technique._id}
                  href={`/technique/${technique._id}`}
                  className="group rounded-lg border bg-card p-6 transition-colors hover:bg-accent"
                >
                  <h3 className="text-lg font-semibold group-hover:text-primary mb-2">
                    {technique.name}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {technique.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {technique.sub_category && (
                      <span className="rounded-full bg-secondary px-2 py-1">
                        {technique.sub_category}
                      </span>
                    )}
                    {technique.detail_category && (
                      <span className="rounded-full bg-secondary px-2 py-1">
                        {technique.detail_category}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border bg-card p-12 text-center">
              <p className="text-muted-foreground">
                아직 이 카테고리에 등록된 기술이 없습니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
