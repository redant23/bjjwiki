'use client';

import { useEffect, useState } from 'react';
import { Search, X, Loader2, ChevronDown, ChevronRight, Check } from 'lucide-react';

interface LightTechnique {
  _id: string;
  name: { ko: string; en?: string };
  slug: string;
  parentId: string | null;
  pathSlugs: string[];
}

interface TreeNode extends LightTechnique {
  children: TreeNode[];
}

interface TechniqueParentPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (technique: { _id: string; name: { ko: string; en?: string } } | null) => void;
  selectedId?: string | null;
  excludeId?: string;
  excludeSlug?: string;
}

function buildTree(flat: LightTechnique[]): TreeNode[] {
  const nodes: TreeNode[] = flat.map((t) => ({ ...t, children: [] }));
  const map = new Map<string, TreeNode>();
  nodes.forEach((n) => map.set(n._id, n));

  const roots: TreeNode[] = [];
  nodes.forEach((n) => {
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children.push(n);
    } else {
      roots.push(n);
    }
  });
  return roots;
}

export function TechniqueParentPicker({
  isOpen,
  onClose,
  onSelect,
  selectedId,
  excludeId,
  excludeSlug,
}: TechniqueParentPickerProps) {
  const [all, setAll] = useState<LightTechnique[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LightTechnique[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setSearchResults(null);
    setLoadError('');

    async function fetchAll() {
      try {
        const res = await fetch('/api/techniques?fields=light');
        const data = await res.json();
        if (data.success) {
          setAll(data.data);
        } else {
          setLoadError(data.error || '기술 목록을 불러오지 못했습니다.');
        }
      } catch {
        setLoadError('오류가 발생했습니다.');
      }
    }
    fetchAll();
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    const timeoutId = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/techniques?search=${encodeURIComponent(query)}&fields=light`);
        const data = await res.json();
        if (data.success) {
          setSearchResults(data.data);
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  function isExcluded(t: LightTechnique): boolean {
    if (excludeId && t._id === excludeId) return true;
    if (excludeSlug && t.pathSlugs.includes(excludeSlug)) return true;
    return false;
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleSelect(t: LightTechnique) {
    onSelect({ _id: t._id, name: t.name });
    onClose();
  }

  function handleSelectNone() {
    onSelect(null);
    onClose();
  }

  function renderNode(node: TreeNode, depth: number) {
    const hasChildren = node.children.length > 0;
    const isExpanded = !!expanded[node._id];
    const isSelected = selectedId === node._id;

    return (
      <div key={node._id}>
        <div
          className={`flex items-center py-1.5 px-2 rounded-md transition-colors ${
            isSelected ? 'bg-accent/10 font-semibold text-accent' : 'hover:bg-muted/50'
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpand(node._id)}
              className="p-0.5 rounded mr-1.5 text-muted-foreground hover:bg-muted"
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
          <button
            type="button"
            onClick={() => handleSelect(node)}
            className="flex-1 text-left text-sm truncate"
          >
            {node.name.ko}
          </button>
          {isSelected && <Check className="h-4 w-4 text-accent" />}
        </div>
        {hasChildren && isExpanded && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  }

  if (!isOpen) return null;

  const filteredAll = (all || []).filter((t) => !isExcluded(t));
  const tree = buildTree(filteredAll);
  const filteredSearchResults = (searchResults || []).filter((t) => !isExcluded(t));
  const showingSearch = query.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-background rounded-lg shadow-2xl border border-border overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center px-4 py-3 border-b border-border">
          <Search className="h-5 w-5 text-muted-foreground mr-3" />
          <input
            type="text"
            autoFocus
            placeholder="기술 검색..."
            className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {searching ? (
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-muted rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="overflow-y-auto p-2">
          <button
            type="button"
            onClick={handleSelectNone}
            className={`w-full flex items-center justify-between px-2 py-2 rounded-md text-sm mb-1 ${
              !selectedId ? 'bg-accent/10 font-semibold text-accent' : 'hover:bg-muted/50'
            }`}
          >
            없음 (최상위)
            {!selectedId && <Check className="h-4 w-4 text-accent" />}
          </button>

          {loadError && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {loadError}
            </div>
          )}

          {!loadError && showingSearch && (
            filteredSearchResults.length > 0 ? (
              <div className="space-y-0.5">
                {filteredSearchResults.map((t) => (
                  <button
                    key={t._id}
                    type="button"
                    onClick={() => handleSelect(t)}
                    className={`w-full flex items-center justify-between px-2 py-2 rounded-md text-sm ${
                      selectedId === t._id ? 'bg-accent/10 font-semibold text-accent' : 'hover:bg-muted/50'
                    }`}
                  >
                    {t.name.ko}
                    {selectedId === t._id && <Check className="h-4 w-4 text-accent" />}
                  </button>
                ))}
              </div>
            ) : (
              !searching && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  검색 결과가 없습니다.
                </div>
              )
            )
          )}

          {!loadError && !showingSearch && (
            all === null ? (
              <div className="py-8 text-center text-sm text-muted-foreground">불러오는 중...</div>
            ) : tree.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                등록된 기술이 없습니다.
              </div>
            ) : (
              <div>{tree.map((node) => renderNode(node, 0))}</div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
