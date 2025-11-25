'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';

interface Technique {
  _id: string;
  name: string;
  main_category: string;
  sub_category?: string;
  detail_category?: string;
}

interface CategoryTree {
  [mainCategory: string]: {
    [subCategory: string]: {
      [detailCategory: string]: Technique[];
    };
  };
}

export function Sidebar() {
  const pathname = usePathname();
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [categoryTree, setCategoryTree] = useState<CategoryTree>({});
  const [openMain, setOpenMain] = useState<Record<string, boolean>>({});
  const [openSub, setOpenSub] = useState<Record<string, boolean>>({});
  const [openDetail, setOpenDetail] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchTechniques() {
      try {
        const res = await fetch(`/api/techniques?search=${searchQuery}`);
        const data = await res.json();
        if (data.success) {
          const techs: Technique[] = data.data;
          setTechniques(techs);

          // Build category tree
          const tree: CategoryTree = {};
          techs.forEach((tech) => {
            const main = tech.main_category;
            const sub = tech.sub_category || '_root';
            const detail = tech.detail_category || '_root';

            if (!tree[main]) tree[main] = {};
            if (!tree[main][sub]) tree[main][sub] = {};
            if (!tree[main][sub][detail]) tree[main][sub][detail] = [];

            tree[main][sub][detail].push(tech);
          });

          setCategoryTree(tree);

          // Open all categories by default
          const mainCats = Object.keys(tree);
          const initialMainOpen = mainCats.reduce((acc, cat) => ({ ...acc, [cat]: true }), {});
          setOpenMain(initialMainOpen);

          const subKeys: string[] = [];
          const detailKeys: string[] = [];
          mainCats.forEach((main) => {
            Object.keys(tree[main]).forEach((sub) => {
              const subKey = `${main}::${sub}`;
              subKeys.push(subKey);
              Object.keys(tree[main][sub]).forEach((detail) => {
                if (detail !== '_root') {
                  detailKeys.push(`${subKey}::${detail}`);
                }
              });
            });
          });

          const initialSubOpen = subKeys.reduce((acc, key) => ({ ...acc, [key]: true }), {});
          const initialDetailOpen = detailKeys.reduce((acc, key) => ({ ...acc, [key]: true }), {});

          setOpenSub(initialSubOpen);
          setOpenDetail(initialDetailOpen);
        }
      } catch (error) {
        console.error('Failed to fetch techniques', error);
      } finally {
        setLoading(false);
      }
    }

    const timeoutId = setTimeout(() => {
      fetchTechniques();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const toggleMain = (category: string) => {
    setOpenMain((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const toggleSub = (key: string) => {
    setOpenSub((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleDetail = (key: string) => {
    setOpenDetail((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading && !techniques.length) {
    return (
      <aside className="fixed top-14 z-30 -ml-2 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 md:sticky md:block">
        <div className="h-full py-6 pl-8 pr-6 lg:py-8">
          <div className="mb-4">
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 w-full animate-pulse rounded bg-muted" />
            ))}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="fixed top-14 z-30 -ml-2 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 md:sticky md:block overflow-y-auto">
      <div className="h-full py-6 pl-8 pr-6 lg:py-8">
        <div className="mb-4 relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="기술 검색..."
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full">
          {Object.keys(categoryTree).sort().map((mainCategory) => (
            <div key={mainCategory} className="pb-3">
              {/* Main Category */}
              <div className="flex items-center justify-between">
                <Link
                  href={`/category/${encodeURIComponent(mainCategory)}`}
                  className="flex-1 py-1.5 text-sm font-bold hover:underline"
                >
                  {mainCategory}
                </Link>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMain(mainCategory);
                  }}
                  className="p-1 hover:bg-accent rounded"
                  aria-label="토글"
                >
                  {openMain[mainCategory] ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </div>

              {openMain[mainCategory] && (
                <div className="ml-2 mt-1 border-l-2 border-muted pl-2">
                  {Object.keys(categoryTree[mainCategory]).sort().map((subCategory) => {
                    const subKey = `${mainCategory}::${subCategory}`;
                    const isRoot = subCategory === '_root';
                    const detailCategories = categoryTree[mainCategory][subCategory];

                    if (isRoot) {
                      // Techniques directly under main category (no sub_category)
                      const rootTechs = detailCategories['_root'] || [];
                      return rootTechs.map((technique) => (
                        <Link
                          key={technique._id}
                          href={`/technique/${technique._id}`}
                          className={cn(
                            "group flex w-full items-center rounded-md border border-transparent px-2 py-1 hover:underline text-muted-foreground hover:text-foreground text-sm",
                            pathname === `/technique/${technique._id}`
                              ? "font-medium text-foreground"
                              : ""
                          )}
                        >
                          {technique.name}
                        </Link>
                      ));
                    }

                    return (
                      <div key={subKey} className="pb-2">
                        {/* Sub Category */}
                        <div className="flex items-center justify-between">
                          <Link
                            href={`/category/${encodeURIComponent(mainCategory)}::${encodeURIComponent(subCategory)}`}
                            className="flex-1 py-1 text-sm font-semibold hover:underline"
                          >
                            {subCategory}
                          </Link>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSub(subKey);
                            }}
                            className="p-1 hover:bg-accent rounded"
                            aria-label="토글"
                          >
                            {openSub[subKey] ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>

                        {openSub[subKey] && (
                          <div className="ml-2 mt-0.5 border-l border-muted pl-2">
                            {Object.keys(detailCategories).sort().map((detailCategory) => {
                              const detailKey = `${subKey}::${detailCategory}`;
                              const isDetailRoot = detailCategory === '_root';
                              const techs = detailCategories[detailCategory];

                              if (isDetailRoot) {
                                // Techniques directly under sub category (no detail_category)
                                return techs.map((technique) => (
                                  <Link
                                    key={technique._id}
                                    href={`/technique/${technique._id}`}
                                    className={cn(
                                      "group flex w-full items-center rounded-md border border-transparent px-2 py-1 hover:underline text-muted-foreground hover:text-foreground text-sm",
                                      pathname === `/technique/${technique._id}`
                                        ? "font-medium text-foreground"
                                        : ""
                                    )}
                                  >
                                    {technique.name}
                                  </Link>
                                ));
                              }

                              return (
                                <div key={detailKey} className="pb-1.5">
                                  {/* Detail Category */}
                                  <div className="flex items-center justify-between">
                                    <Link
                                      href={`/category/${encodeURIComponent(mainCategory)}::${encodeURIComponent(subCategory)}::${encodeURIComponent(detailCategory)}`}
                                      className="flex-1 py-0.5 text-xs font-medium hover:underline text-muted-foreground"
                                    >
                                      {detailCategory}
                                    </Link>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleDetail(detailKey);
                                      }}
                                      className="p-0.5 hover:bg-accent rounded"
                                      aria-label="토글"
                                    >
                                      {openDetail[detailKey] ? (
                                        <ChevronDown className="h-3 w-3" />
                                      ) : (
                                        <ChevronRight className="h-3 w-3" />
                                      )}
                                    </button>
                                  </div>

                                  {openDetail[detailKey] && (
                                    <div className="ml-2 mt-0.5">
                                      {techs.map((technique) => (
                                        <Link
                                          key={technique._id}
                                          href={`/technique/${technique._id}`}
                                          className={cn(
                                            "group flex w-full items-center rounded-md border border-transparent px-2 py-0.5 hover:underline text-muted-foreground hover:text-foreground text-xs",
                                            pathname === `/technique/${technique._id}`
                                              ? "font-medium text-foreground"
                                              : ""
                                          )}
                                        >
                                          {technique.name}
                                        </Link>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          {Object.keys(categoryTree).length === 0 && (
            <div className="text-sm text-muted-foreground">카테고리를 찾을 수 없습니다</div>
          )}
        </div>
      </div>
    </aside>
  );
}
