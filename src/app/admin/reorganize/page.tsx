'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { TechniqueParentPicker } from '@/components/ui/TechniqueParentPicker';
import { ROLE_LABELS } from '@/lib/technique-request-format';

interface FlatTechnique {
  _id: string;
  name: { ko: string; en?: string };
  slug: string;
  parentId: string | null;
  primaryRole: string;
}

interface MoveReport {
  dryRun: boolean;
  moved: number;
  skipped: Array<{ _id: string; reason: 'already_there' | 'duplicate' }>;
  affected: number;
  sample: Array<{ from: string; to: string }>;
}

const SKIP_LABELS = { already_there: '이미 그 상위 기술 아래에 있음', duplicate: '중복 선택' } as const;

export default function AdminReorganizePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<FlatTechnique[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  // 클릭한 순서가 곧 새 부모 아래에서의 순서가 된다.
  const [selected, setSelected] = useState<string[]>([]);
  // null = 아직 고르지 않음, id가 null = 최상위로 이동
  const [target, setTarget] = useState<{ id: string | null; name: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [preview, setPreview] = useState<{ key: string; report: MoveReport } | null>(null);
  const [busy, setBusy] = useState(false);
  const [doneMessage, setDoneMessage] = useState('');

  const isAdmin = status === 'authenticated' && session?.user?.role === 'admin';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated' && session?.user?.role !== 'admin') {
      router.push('/');
    }
  }, [status, session, router]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/techniques?fields=light');
      const data = await res.json();
      if (data.success) {
        setItems(data.data);
        setError('');
      } else {
        setError(data.error || '기술 목록을 불러오지 못했습니다.');
      }
    } catch {
      setError('기술 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const { childrenOf, roots, descendantCount, nameById } = useMemo(() => {
    const childrenOf = new Map<string, FlatTechnique[]>();
    const roots: FlatTechnique[] = [];
    const ids = new Set(items.map((i) => i._id));
    for (const item of items) {
      if (item.parentId && ids.has(item.parentId)) {
        const list = childrenOf.get(item.parentId) ?? [];
        list.push(item);
        childrenOf.set(item.parentId, list);
      } else {
        roots.push(item);
      }
    }
    const descendantCount = new Map<string, number>();
    const count = (id: string): number => {
      const cached = descendantCount.get(id);
      if (cached !== undefined) return cached;
      const total = (childrenOf.get(id) ?? []).reduce((sum, c) => sum + 1 + count(c._id), 0);
      descendantCount.set(id, total);
      return total;
    };
    items.forEach((i) => count(i._id));
    return { childrenOf, roots, descendantCount, nameById: new Map(items.map((i) => [i._id, i.name.ko])) };
  }, [items]);

  // 검색어가 있으면 이름이 맞는 항목과 그 조상만 보여준다.
  const visibleIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const parentOf = new Map(items.map((i) => [i._id, i.parentId]));
    const visible = new Set<string>();
    for (const item of items) {
      if (`${item.name.ko} ${item.name.en ?? ''}`.toLowerCase().includes(q)) {
        let cursor: string | null = item._id;
        while (cursor && !visible.has(cursor)) {
          visible.add(cursor);
          cursor = parentOf.get(cursor) ?? null;
        }
      }
    }
    return visible;
  }, [items, query]);

  const key = JSON.stringify([selected, target?.id ?? null, target !== null]);
  const previewIsCurrent = preview?.key === key;

  function toggleSelected(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setDoneMessage('');
  }

  async function runMove(dryRun: boolean) {
    if (!target) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/move-techniques', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selected, newParentId: target.id, dryRun }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || '처리하지 못했습니다.');
        return;
      }
      if (dryRun) {
        setPreview({ key, report: data.data });
      } else {
        setDoneMessage(
          `${data.data.moved}개 기술을 "${target.name}" 아래로 옮겼습니다. 주소가 바뀐 기술은 ${data.data.affected}개입니다.`
        );
        setSelected([]);
        setPreview(null);
        setTarget(null);
        await load();
        router.refresh();
      }
    } catch {
      setError('처리하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  function handleExecute() {
    if (!preview || !previewIsCurrent || !target) return;
    const ok = confirm(
      `${preview.report.moved}개 기술을 "${target.name}" 아래로 옮깁니다.\n` +
        `주소가 바뀌는 기술이 ${preview.report.affected}개입니다. 옛 주소로 들어와도 새 주소로 자동 이동합니다.\n\n계속할까요?`
    );
    if (ok) runMove(false);
  }

  function renderNode(node: FlatTechnique, depth: number): React.ReactNode {
    if (visibleIds && !visibleIds.has(node._id)) return null;
    const children = childrenOf.get(node._id) ?? [];
    const hasChildren = children.length > 0;
    const isOpen = visibleIds ? true : !!expanded[node._id];
    const order = selected.indexOf(node._id);

    return (
      <div key={node._id}>
        <div
          className="flex items-center gap-2 rounded-md py-1.5 pr-2 hover:bg-muted/50"
          style={{ paddingLeft: `${depth * 20 + 4}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded((p) => ({ ...p, [node._id]: !p[node._id] }))}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted"
              aria-label={isOpen ? '접기' : '펼치기'}
            >
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
            <input type="checkbox" checked={order !== -1} onChange={() => toggleSelected(node._id)} />
            <span className="truncate text-sm">{node.name.ko}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {ROLE_LABELS[node.primaryRole] || node.primaryRole}
              {hasChildren && ` · 하위 ${descendantCount.get(node._id)}개`}
            </span>
          </label>
          {order !== -1 && (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {order + 1}
            </span>
          )}
        </div>
        {hasChildren && isOpen && children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  if (status === 'loading') {
    return <div className="p-8">Loading...</div>;
  }
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container max-w-3xl py-6 pb-48 lg:py-10">
      <Link href="/admin" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="mr-1 h-4 w-4" />
        관리자 대시보드
      </Link>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">분류 정리</h1>
        <p className="text-sm text-muted-foreground">
          옮길 기술을 체크하고 새 상위 기술을 고르세요. 선택한 기술의 하위 기술은 함께 이동합니다. 실행 전에 미리보기로
          영향을 확인합니다. 임시저장 기술은 이 목록에 나오지 않습니다.
        </p>
      </div>

      {error && <div className="mb-4 rounded-md bg-destructive/10 p-4 text-destructive">{error}</div>}
      {doneMessage && <div className="mb-4 rounded-md bg-green-100 p-4 text-green-900">{doneMessage}</div>}

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="기술 이름으로 찾기"
          className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground">불러오는 중...</p>
      ) : (
        <div className="rounded-lg border p-2">{roots.map((root) => renderNode(root, 0))}</div>
      )}

      {/* 하단 고정 작업 바 */}
      <div className="fixed inset-x-0 bottom-16 z-40 border-t bg-background p-4 shadow-lg md:bottom-0 md:left-64">
        <div className="mx-auto max-w-3xl space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              선택 <span className="font-semibold">{selected.length}</span>개
            </span>
            {selected.length > 0 && (
              <button type="button" onClick={() => setSelected([])} className="text-muted-foreground underline">
                선택 해제
              </button>
            )}
            <span className="text-muted-foreground">→ 새 상위 기술:</span>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-input px-3 hover:bg-muted/50"
            >
              {target ? target.name : '선택하세요'}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {preview && previewIsCurrent && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p>
                이동 <span className="font-semibold">{preview.report.moved}</span>개 · 주소가 바뀌는 기술{' '}
                <span className="font-semibold">{preview.report.affected}</span>개 (하위 기술 포함)
              </p>
              {preview.report.skipped.length > 0 && (
                <p className="mt-1 text-muted-foreground">
                  건너뜀:{' '}
                  {preview.report.skipped
                    .map((s) => `${nameById.get(s._id) ?? s._id}(${SKIP_LABELS[s.reason]})`)
                    .join(', ')}
                </p>
              )}
              {preview.report.sample.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {preview.report.sample.slice(0, 3).map((s) => (
                    <li key={s.from} className="break-all">
                      {s.from} → {s.to}
                    </li>
                  ))}
                  {preview.report.sample.length > 3 && <li>외 {preview.report.sample.length - 3}개…</li>}
                </ul>
              )}
              {preview.report.moved === 0 && <p className="mt-1">옮길 기술이 없습니다.</p>}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || selected.length === 0 || !target}
              onClick={() => runMove(true)}
              className="inline-flex h-10 items-center rounded-md border border-input px-4 text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
            >
              미리보기
            </button>
            <button
              type="button"
              disabled={busy || !previewIsCurrent || !preview || preview.report.moved === 0}
              onClick={handleExecute}
              className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              title={previewIsCurrent ? undefined : '선택이나 새 상위 기술을 바꾸면 미리보기를 다시 해야 합니다.'}
            >
              이동 실행
            </button>
          </div>
        </div>
      </div>

      <TechniqueParentPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedId={target?.id ?? null}
        onSelect={(technique) => {
          setTarget(technique ? { id: technique._id, name: technique.name.ko } : { id: null, name: '최상위' });
          setDoneMessage('');
        }}
      />
    </div>
  );
}
