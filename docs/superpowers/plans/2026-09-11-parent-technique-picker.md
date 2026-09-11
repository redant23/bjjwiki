# 상위 기술 선택 UI 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기술 등록/수정 페이지의 "상위 기술" 필드를 모든 기술을 나열하는 평평한 `<select>`에서, 검색 + 분류 트리를 함께 제공하는 모달 선택기로 바꾼다.

**Architecture:** 새 공용 컴포넌트 `TechniqueParentPicker`를 만든다 — 검색어가 비었을 때는 `Sidebar.tsx`의 트리 렌더링 방식으로 분류 트리를(기존 `GET /api/techniques?fields=light`를 클라이언트에서 `getTechniqueTree()`와 동일한 알고리즘으로 트리 변환), 검색어가 있을 때는 `SearchModal.tsx`와 동일한 디바운스 검색(`GET /api/techniques?search=...&fields=light`)으로 평평한 결과를 보여준다. 새 API는 추가하지 않는다. `technique/new/page.tsx`와 `technique/[...slug]/page.tsx`(수정 모드) 양쪽에서 기존 `<select>`를 이 컴포넌트로 교체한다.

**Tech Stack:** Next.js 16 App Router, React (client component), lucide-react 아이콘.

**테스트 방법에 대한 메모:** 테스트 프레임워크가 없다. 이 워크트리에는 `.env.local`이 없어 `MONGODB_URI`가 정의되지 않은 상태라 브라우저/curl로 실제 확인이 불가능하다(모든 페이지가 500). 각 태스크는 `npx tsc --noEmit` + `npx eslint`로 검증하고, `.env.local`이 설정된 환경에서 수행할 수동 브라우저 확인 절차를 각 태스크에 안내로 남긴다.

---

## Task 1: `TechniqueParentPicker` 컴포넌트 신규 생성

**Files:**
- Create: `src/components/ui/TechniqueParentPicker.tsx`

- [ ] **Step 1: 파일 생성**

```tsx
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
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: Lint 확인**

Run: `npx eslint src/components/ui/TechniqueParentPicker.tsx`
Expected: 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/TechniqueParentPicker.tsx
git commit -m "$(cat <<'EOF'
Add TechniqueParentPicker component

Search + category-tree modal for picking a parent technique, reusing
existing patterns instead of new backend surface: SearchModal's
debounced search, Sidebar's tree rendering, and the same
map/roots tree-building algorithm as getTechniqueTree(), applied
client-side to GET /api/techniques?fields=light. Supports excluding
a technique (and its descendants, via pathSlugs containment) so the
edit page can't let a technique become its own ancestor.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `technique/new/page.tsx`에 적용

**Files:**
- Modify: `src/app/technique/new/page.tsx`

- [ ] **Step 1: import 교체**

```tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ChevronLeft, Upload, X } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { MarkdownEditor } from '@/components/ui/MarkdownEditor';
import { VideoUrlInput } from '@/components/ui/VideoUrlInput';
import { TagInput } from '@/components/ui/TagInput';
```
을 다음으로 교체:
```tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ChevronLeft, ChevronDown, Upload, X } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { MarkdownEditor } from '@/components/ui/MarkdownEditor';
import { VideoUrlInput } from '@/components/ui/VideoUrlInput';
import { TagInput } from '@/components/ui/TagInput';
import { TechniqueParentPicker } from '@/components/ui/TechniqueParentPicker';
```

- [ ] **Step 2: 기존 `parents` state/fetch 제거하고 피커용 state 추가**

```tsx
  const [parents, setParents] = useState<{ _id: string, name: { ko: string } }[]>([]);

  useEffect(() => {
    // Fetch potential parents (all techniques for now, or filter by positions)
    async function fetchParents() {
      try {
        const res = await fetch('/api/techniques?status=published');
        const data = await res.json();
        if (data.success) {
          setParents(data.data);
        }
      } catch {
        console.error('Failed to fetch parents');
      }
    }
    fetchParents();
  }, []);
```
을 다음으로 교체:
```tsx
  const [parentName, setParentName] = useState('');
  const [parentPickerOpen, setParentPickerOpen] = useState(false);
```

- [ ] **Step 3: "상위 기술" `<select>`를 트리거 버튼으로 교체**

```tsx
            <div className="grid gap-2">
              <label className="text-sm font-medium">상위 기술 (선택)</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.parentId}
                onChange={e => setFormData({ ...formData, parentId: e.target.value })}
              >
                <option value="">없음 (최상위)</option>
                {parents.map(p => (
                  <option key={p._id} value={p._id}>
                    {p.name.ko}
                  </option>
                ))}
              </select>
            </div>
```
을 다음으로 교체:
```tsx
            <div className="grid gap-2">
              <label className="text-sm font-medium">상위 기술 (선택)</label>
              <button
                type="button"
                onClick={() => setParentPickerOpen(true)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className={parentName ? '' : 'text-muted-foreground'}>
                  {parentName || '없음 (최상위)'}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
```

- [ ] **Step 4: 모달 렌더링 추가**

```tsx
        </form>
      </div>
    </div>
  );
}
```
을 다음으로 교체:
```tsx
        </form>
      </div>

      <TechniqueParentPicker
        isOpen={parentPickerOpen}
        onClose={() => setParentPickerOpen(false)}
        selectedId={formData.parentId || null}
        onSelect={(technique) => {
          setFormData({ ...formData, parentId: technique?._id || '' });
          setParentName(technique?.name.ko || '');
        }}
      />
    </div>
  );
}
```

- [ ] **Step 5: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: Lint 확인**

Run: `npx eslint src/app/technique/new/page.tsx`
Expected: 에러 없음(기존에 있던 `<img>` 경고 1개는 이 변경과 무관하게 남아있음 — 새 에러가 없는지만 확인).

- [ ] **Step 7: 브라우저로 최종 확인**

`.env.local`이 설정된 환경에서 admin으로 로그인 후 `/technique/new` 접속:
1. "상위 기술 (선택)" 자리가 버튼으로 바뀌어 있고 "없음 (최상위)"가 표시되는지 확인.
2. 버튼 클릭 → 모달이 열리고, 검색창이 비어있을 때 분류 트리가 보이는지, 펼치기/접기가 되는지 확인.
3. 트리에서 기술 하나 클릭 → 모달이 닫히고 버튼에 그 기술 이름이 표시되는지 확인.
4. 다시 버튼 클릭 → 검색창에 타이핑 → 트리 대신 검색 결과가 뜨는지, 클릭하면 선택되는지 확인.
5. "없음 (최상위)" 클릭 → 선택이 해제되고 버튼에 다시 "없음 (최상위)"가 표시되는지 확인.
6. 기술을 하나 선택한 채로 폼을 제출 → 생성된 기술이 실제로 그 기술의 하위로 들어갔는지(사이드바에서) 확인.

- [ ] **Step 8: Commit**

```bash
git add src/app/technique/new/page.tsx
git commit -m "$(cat <<'EOF'
Use TechniqueParentPicker in the technique registration form

Replaces the flat <select> listing every technique with the new
search + category-tree modal. Drops the now-unused parents state
and its dedicated fetch.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `technique/[...slug]/page.tsx` 수정 모드에 적용

**Files:**
- Modify: `src/app/technique/[...slug]/page.tsx`

- [ ] **Step 1: import 교체**

```tsx
import { Edit, Save, X, Trash2, Upload } from 'lucide-react';
```
을 다음으로 교체:
```tsx
import { Edit, Save, X, Trash2, Upload, ChevronDown } from 'lucide-react';
```
그리고 파일 상단 import 블록에 다음을 추가:
```tsx
import { TechniqueParentPicker } from '@/components/ui/TechniqueParentPicker';
```

- [ ] **Step 2: 피커용 state 추가, 기존 `allTechniques` state 제거**

```tsx
  const [allTechniques, setAllTechniques] = useState<Technique[]>([]);
```
을 다음으로 교체:
```tsx
  const [parentName, setParentName] = useState('');
  const [parentPickerOpen, setParentPickerOpen] = useState(false);
```

- [ ] **Step 3: `fetchAllTechniques` 함수와 그 호출 제거**

```tsx
    async function fetchAllTechniques() {
      try {
        const res = await fetch('/api/techniques?status=published');
        const data = await res.json();
        if (data.success) {
          setAllTechniques(data.data);
        }
      } catch (err) {
        console.error('Failed to fetch techniques:', err);
      }
    }

    if (currentSlug) {
      fetchTechnique();
      fetchAllTechniques();
    }
  }, [currentSlug]);
```
을 다음으로 교체:
```tsx
    if (currentSlug) {
      fetchTechnique();
    }
  }, [currentSlug]);
```

- [ ] **Step 4: 최초 데이터 로드 시 `parentName` 초기화**

```tsx
              parentId: detailData.data.parentId?._id || null,
              videoUrls: detailData.data.videos?.map((v: any) => v.url) || [],
              thumbnailUrl: detailData.data.thumbnailUrl || '',
            });
            setPreviewUrl(detailData.data.thumbnailUrl || '');
```
을 다음으로 교체:
```tsx
              parentId: detailData.data.parentId?._id || null,
              videoUrls: detailData.data.videos?.map((v: any) => v.url) || [],
              thumbnailUrl: detailData.data.thumbnailUrl || '',
            });
            setParentName(detailData.data.parentId?.name.ko || '');
            setPreviewUrl(detailData.data.thumbnailUrl || '');
```

- [ ] **Step 5: `handleCancel`에서 `parentName`도 원래 값으로 되돌리기**

```tsx
      parentId: technique.parentId?._id || null,
      videoUrls: technique.videos?.map(v => v.url) || [],
      thumbnailUrl: technique.thumbnailUrl || '',
    });
    setThumbnailFile(null);
    setPreviewUrl(technique.thumbnailUrl || '');
    setIsEditing(false);
  };
```
을 다음으로 교체:
```tsx
      parentId: technique.parentId?._id || null,
      videoUrls: technique.videos?.map(v => v.url) || [],
      thumbnailUrl: technique.thumbnailUrl || '',
    });
    setParentName(technique.parentId?.name.ko || '');
    setThumbnailFile(null);
    setPreviewUrl(technique.thumbnailUrl || '');
    setIsEditing(false);
  };
```

- [ ] **Step 6: "상위 기술 (Parent)" `<select>`를 트리거 버튼으로 교체**

```tsx
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">상위 기술 (Parent)</label>
                  <select
                    value={editForm.parentId || ''}
                    onChange={(e) => setEditForm({ ...editForm, parentId: e.target.value || null })}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">없음 (최상위)</option>
                    {allTechniques
                      .filter(t => t._id !== technique?._id) // Prevent selecting self
                      .sort((a, b) => a.name.ko.localeCompare(b.name.ko))
                      .map((tech) => (
                        <option key={tech._id} value={tech._id}>
                          {tech.name.ko} {tech.name.en ? `(${tech.name.en})` : ''} - Level {tech.level}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
```
을 다음으로 교체:
```tsx
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">상위 기술 (Parent)</label>
                  <button
                    type="button"
                    onClick={() => setParentPickerOpen(true)}
                    className="flex w-full items-center justify-between px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                  >
                    <span className={parentName ? '' : 'text-muted-foreground'}>
                      {parentName || '없음 (최상위)'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
```

- [ ] **Step 7: 모달 렌더링 추가**

```tsx
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```
(Delete Confirmation Modal을 감싸는 블록의 끝, 파일 맨 끝 부분)을 다음으로 교체:
```tsx
            </div>
          </div>
        </div>
      )}

      <TechniqueParentPicker
        isOpen={parentPickerOpen}
        onClose={() => setParentPickerOpen(false)}
        selectedId={editForm.parentId}
        excludeId={technique?._id}
        excludeSlug={technique?.slug}
        onSelect={(selected) => {
          setEditForm({ ...editForm, parentId: selected?._id || null });
          setParentName(selected?.name.ko || '');
        }}
      />
    </div>
  );
}
```

- [ ] **Step 8: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 9: Lint 확인**

Run: `npx eslint "src/app/technique/[...slug]/page.tsx"`
Expected: 에러 없음(기존에 있던 `any`/`<img>` 관련 항목들은 이 변경과 무관하게 남아있음 — 새 에러가 없는지만 확인).

- [ ] **Step 10: 브라우저로 최종 확인**

`.env.local`이 설정된 환경에서 admin으로 로그인 후, 하위 기술이 있는 기술의 상세 페이지에서 "수정" 클릭:
1. "상위 기술 (Parent)" 자리가 버튼으로 바뀌어 있고 현재 상위 기술 이름(또는 "없음 (최상위)")이 표시되는지 확인.
2. 버튼 클릭 → 모달에서 지금 편집 중인 기술 자신과 그 하위 기술들이 트리/검색 결과 어디에도 안 보이는지 확인.
3. 다른 기술로 상위를 바꾸고 저장 → 사이드바에서 실제로 그 기술 아래로 이동했는지 확인.
4. "수정" 진입 후 상위 기술을 바꿨다가 "취소" 클릭 → 버튼에 표시되는 이름이 원래 값으로 돌아가는지 확인.

- [ ] **Step 11: Commit**

```bash
git add "src/app/technique/[...slug]/page.tsx"
git commit -m "$(cat <<'EOF'
Use TechniqueParentPicker in the technique edit form

Replaces the flat <select> (which only excluded the technique
itself, not its descendants) with the new search + category-tree
modal, passing excludeId/excludeSlug so a technique can't become its
own ancestor. Drops the now-unused allTechniques state and its
dedicated fetch.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
