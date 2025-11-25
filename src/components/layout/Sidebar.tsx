'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';

interface Technique {
  _id: string;
  name: string;
  category: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
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

          // Extract unique categories from the filtered results
          const cats = Array.from(new Set(techs.map((t) => t.category)));
          setCategories(cats);

          // Open all categories by default when searching or initially
          const initialOpenState = cats.reduce((acc, cat) => ({ ...acc, [cat]: true }), {});
          setOpenCategories(initialOpenState);
        }
      } catch (error) {
        console.error('Failed to fetch techniques', error);
      } finally {
        setLoading(false);
      }
    }

    // Debounce search
    const timeoutId = setTimeout(() => {
      fetchTechniques();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const toggleCategory = (category: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
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
            placeholder="Search techniques..."
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full">
          {categories.map((category) => (
            <div key={category} className="pb-4">
              <button
                onClick={() => toggleCategory(category)}
                className="flex w-full items-center justify-between py-1 text-sm font-semibold hover:underline"
              >
                {category}
                {openCategories[category] ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              {openCategories[category] && (
                <div className="grid grid-flow-row auto-rows-max text-sm mt-1">
                  {techniques
                    .filter((t) => t.category === category)
                    .map((technique) => (
                      <Link
                        key={technique._id}
                        href={`/technique/${technique._id}`}
                        className={cn(
                          "group flex w-full items-center rounded-md border border-transparent px-2 py-1 hover:underline text-muted-foreground hover:text-foreground",
                          pathname === `/technique/${technique._id}`
                            ? "font-medium text-foreground"
                            : ""
                        )}
                      >
                        {technique.name}
                      </Link>
                    ))}
                  {techniques.filter((t) => t.category === category).length === 0 && (
                    <span className="text-muted-foreground px-2 py-1">
                      No techniques
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
          {categories.length === 0 && (
            <div className="text-sm text-muted-foreground">No categories found</div>
          )}
        </div>
      </div>
    </aside>
  );
}
