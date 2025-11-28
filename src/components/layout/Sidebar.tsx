'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Search, ArrowUp, ArrowDown, Settings, Check } from 'lucide-react';

interface Technique {
  _id: string;
  name: { ko: string; en?: string };
  slug: string;
  parentId?: string;
  pathSlugs: string[];
  children?: Technique[];
  order?: number;
}

interface SidebarProps {
  mobile?: boolean;
  onLinkClick?: () => void;
}

export function Sidebar({ mobile, onLinkClick }: SidebarProps) {
  const pathname = usePathname();
  const [tree, setTree] = useState<Technique[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  useEffect(() => {
    async function fetchTechniques() {
      try {
        const res = await fetch(`/api/techniques?search=${searchQuery}&fields=light`);
        const data = await res.json();
        if (data.success) {
          const techs: Technique[] = data.data;
          const builtTree = buildTree(techs);
          setTree(builtTree);

          // Auto-expand if searching
          if (searchQuery) {
            const allIds = techs.reduce((acc, t) => ({ ...acc, [t._id]: true }), {});
            setExpanded(allIds);
          } else {
            // Expand roots by default if not already expanded
            setExpanded(prev => {
              if (Object.keys(prev).length === 0) {
                return builtTree.reduce((acc, t) => ({ ...acc, [t._id]: true }), {});
              }
              return prev;
            });
          }
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

  const buildTree = (items: Technique[]) => {
    const map = new Map<string, Technique>();
    const roots: Technique[] = [];

    // First pass: create nodes
    items.forEach(item => {
      map.set(item._id, { ...item, children: [] });
    });

    // Second pass: link children
    items.forEach(item => {
      if (item.parentId && map.has(item.parentId)) {
        map.get(item.parentId)!.children!.push(map.get(item._id)!);
      } else {
        roots.push(map.get(item._id)!);
      }
    });

    // Sort function
    const sortFn = (a: Technique, b: Technique) => {
      if (a.order !== b.order) {
        return (a.order || 0) - (b.order || 0);
      }
      return a.name.ko.localeCompare(b.name.ko);
    };

    // Sort roots
    roots.sort(sortFn);

    // Sort children recursively (or just iterate map)
    map.forEach(node => {
      if (node.children && node.children.length > 0) {
        node.children.sort(sortFn);
      }
    });

    return roots;
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleMove = async (node: Technique, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSavingOrder) return;

    // Helper to find and swap nodes in the tree
    const newTree = [...tree];
    let parentChildren: Technique[] = newTree;

    // Find the array containing the node
    if (node.parentId) {
      const findParent = (nodes: Technique[]): Technique | null => {
        for (const n of nodes) {
          if (n._id === node.parentId) return n;
          if (n.children) {
            const found = findParent(n.children);
            if (found) return found;
          }
        }
        return null;
      };
      const parent = findParent(newTree);
      if (parent && parent.children) {
        parentChildren = parent.children;
      }
    }

    const index = parentChildren.findIndex(n => n._id === node._id);
    if (index === -1) return;

    // Check bounds
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === parentChildren.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    // Swap
    const temp = parentChildren[index];
    parentChildren[index] = parentChildren[targetIndex];
    parentChildren[targetIndex] = temp;

    // Update orders
    // We assign orders based on index to ensure consistency
    const updates = parentChildren.map((n, i) => ({
      _id: n._id,
      order: i
    }));

    // Optimistic update
    setTree(newTree);
    setIsSavingOrder(true);

    try {
      await fetch('/api/techniques/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updates }),
      });
    } catch (error) {
      console.error('Failed to save order', error);
      // TODO: Revert on error
    } finally {
      setIsSavingOrder(false);
    }
  };

  const renderNode = (node: Technique, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expanded[node._id];
    const href = `/technique/${[...(node.pathSlugs || []), node.slug].join('/')}`;
    const isActive = pathname === href;

    return (
      <div key={node._id} className="select-none">
        <div
          className={cn(
            "flex items-center py-1.5 px-2 rounded-md transition-colors group",
            isActive
              ? "bg-accent/10 font-bold text-accent"
              : "text-foreground hover:bg-muted/50"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {hasChildren ? (
            <button
              onClick={(e) => toggleExpand(node._id, e)}
              className={cn(
                "p-0.5 rounded mr-1.5 transition-colors",
                isActive
                  ? "text-accent hover:bg-accent/20"
                  : "text-muted-foreground/70 hover:bg-muted hover:text-foreground"
              )}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}

          <Link
            href={href}
            onClick={() => onLinkClick?.()}
            className={cn(
              "flex-1 text-sm truncate transition-colors",
              isActive ? "text-accent" : ""
            )}
          >
            {node.name.ko}
          </Link>

          {isEditingOrder && depth === 0 && (
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={(e) => handleMove(node, 'up', e)}
                className="p-1 hover:bg-accent/20 rounded text-muted-foreground hover:text-accent"
                title="위로 이동"
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => handleMove(node, 'down', e)}
                className="p-1 hover:bg-accent/20 rounded text-muted-foreground hover:text-accent"
                title="아래로 이동"
              >
                <ArrowDown className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="border-l border-border/30 ml-4 pl-1">
            {node.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const sidebarClasses = cn(
    "fixed top-14 left-0 z-30 h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-border bg-background",
    mobile ? "block w-full border-none" : "hidden md:block"
  );

  if (loading && !tree.length) {
    return (
      <aside className={sidebarClasses}>
        <div className="h-full py-6 px-4 space-y-4">
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-full animate-pulse rounded bg-muted" />
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className={sidebarClasses}>
      <div className="h-full py-6 px-4">
        {/* Only show search in sidebar if it's NOT mobile (since mobile has search in navbar/modal) 
            Actually, user requested search bar in navbar for desktop too. 
            So we might remove search from sidebar entirely or keep it as secondary.
            Let's keep it for now but maybe hide it if mobile? 
            The requirement said "Search bar in Navbar for desktop".
            Let's remove search from Sidebar to avoid duplication and clutter, as per modern design patterns.
        */}
        {/* 
        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="기술 검색..."
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        */}
        {/* Order Edit Button */}
        <div className="pb-4 bg-background">
          <button
            onClick={() => setIsEditingOrder(!isEditingOrder)}
            className={cn(
              "flex items-center justify-center w-full gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors",
              isEditingOrder
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {isEditingOrder ? (
              <>
                <Check className="h-4 w-4" />
                편집 완료
              </>
            ) : (
              <>
                <Settings className="h-4 w-4" />
                순서 편집
              </>
            )}
          </button>
        </div>

        <nav className="w-full space-y-1 pb-40">
          {tree.map(node => renderNode(node))}

          {tree.length === 0 && !loading && (
            <div className="text-sm text-muted-foreground text-center py-4">
              기술이 없습니다.
            </div>
          )}
        </nav>


      </div>
    </aside>
  );
}
