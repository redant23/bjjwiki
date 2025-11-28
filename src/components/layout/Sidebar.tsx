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
  initialTree: Technique[];
}

export function Sidebar({ mobile, onLinkClick, initialTree = [] }: SidebarProps) {
  console.log('[Sidebar] Render. initialTree:', initialTree?.length);
  const pathname = usePathname();
  const [tree, setTree] = useState<Technique[]>(initialTree || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);



  // Auto-expand based on current path
  useEffect(() => {
    if (pathname.startsWith('/technique/')) {
      const expandedIds: Record<string, boolean> = {};

      // We need to flatten the tree to search easily, or just traverse
      // Since we don't have a flat list in state easily accessible without traversing,
      // let's traverse the tree state.
      const traverse = (nodes: Technique[]) => {
        nodes.forEach(node => {
          const href = `/technique/${[...(node.pathSlugs || []), node.slug].join('/')}`;
          if (pathname.startsWith(href)) {
            expandedIds[node._id] = true;
          }
          if (node.children) traverse(node.children);
        });
      };
      traverse(tree);

      setExpanded(prev => ({ ...prev, ...expandedIds }));
    }
  }, [pathname, tree]);



  const expandNode = (node: Technique) => {
    const isExpanding = !expanded[node._id];

    // If it's a root node (no parentId) and we are expanding it
    if (!node.parentId && isExpanding) {
      // Close other root nodes
      const newExpanded = { ...expanded };

      // Find all root nodes from the tree state
      tree.forEach(root => {
        if (root._id !== node._id) {
          newExpanded[root._id] = false;
        }
      });

      newExpanded[node._id] = true;
      setExpanded(newExpanded);
    } else {
      // Normal toggle
      setExpanded(prev => ({ ...prev, [node._id]: !prev[node._id] }));
    }
  };

  const toggleExpand = (node: Technique, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    expandNode(node);
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
          style={{ paddingLeft: `${depth * 6 + 2}px` }}
        >
          {hasChildren ? (
            <button
              onClick={(e) => toggleExpand(node, e)}
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
            onClick={() => {
              // Only close sidebar if it's a leaf node (no children)
              if (!hasChildren) {
                onLinkClick?.();
              }
              // Only toggle if it has children, otherwise just navigate
              if (hasChildren) {
                expandNode(node);
              }
            }}
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

  if (!tree.length) {
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

          {tree.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              기술이 없습니다.
            </div>
          )}
        </nav>


      </div>
    </aside>
  );
}
