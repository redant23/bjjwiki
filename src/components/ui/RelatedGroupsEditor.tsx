'use client';

import { Plus, Trash2 } from 'lucide-react';
import { LinkedTechniquesInput, type LinkedTechnique } from '@/components/ui/LinkedTechniquesInput';
import {
  RELATED_GROUP_TITLE_MAX,
  RELATED_GROUPS_MAX,
  RELATED_GROUP_ITEMS_MAX,
} from '@/lib/technique-form';

export interface EditableRelatedGroup {
  title: string;
  techniques: LinkedTechnique[];
}

interface PopulatedGroup {
  title: string;
  techniques?: Array<{ _id: string; name: { ko: string } }>;
}

/** 서버에서 populate되어 온 목록을 편집 상태로 바꾼다. */
export function toEditableGroups(groups?: PopulatedGroup[] | null): EditableRelatedGroup[] {
  return (groups ?? []).map((g) => ({
    title: g.title,
    techniques: (g.techniques ?? []).map((t) => ({ _id: t._id, name: { ko: t.name.ko } })),
  }));
}

/** 저장용 payload. 제목이 비었거나 기술이 없는 목록은 서버에서도 버려지므로 미리 거른다. */
export function toPayloadGroups(groups: EditableRelatedGroup[]) {
  return groups
    .filter((g) => g.title.trim() && g.techniques.length > 0)
    .map((g) => ({ title: g.title.trim(), techniques: g.techniques.map((t) => t._id) }));
}

const TITLE_SUGGESTIONS = ['이어지는 스윕', '이어지는 서브미션', '이어지는 이스케이프', '방어법', '카운터', '진입', '연습 드릴'];

interface RelatedGroupsEditorProps {
  groups: EditableRelatedGroup[];
  onChange: (groups: EditableRelatedGroup[]) => void;
  excludeId?: string;
}

// 작성자가 목록의 제목을 직접 짓고, 그 아래에 기술들을 골라 넣는다. 상세 페이지에 제목별로 보인다.
export function RelatedGroupsEditor({ groups, onChange, excludeId }: RelatedGroupsEditorProps) {
  const update = (index: number, patch: Partial<EditableRelatedGroup>) =>
    onChange(groups.map((g, i) => (i === index ? { ...g, ...patch } : g)));

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">연결 기술 목록 (선택)</h3>
        <p className="text-xs text-muted-foreground">
          제목을 정하고 관련 기술을 골라 넣으면, 상세 페이지에 그 제목 아래로 보여집니다. 제목이나 기술이 비어 있는 목록은 저장되지 않습니다.
        </p>
      </div>

      <datalist id="related-group-title-suggestions">
        {TITLE_SUGGESTIONS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      {groups.map((group, index) => (
        <div key={index} className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2">
            <input
              list="related-group-title-suggestions"
              value={group.title}
              maxLength={RELATED_GROUP_TITLE_MAX}
              onChange={(e) => update(index, { title: e.target.value })}
              placeholder="목록 제목 (예: 방어법)"
              aria-label="목록 제목"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="button"
              onClick={() => onChange(groups.filter((_, i) => i !== index))}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-input text-destructive hover:bg-destructive/10"
              title="목록 삭제"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <LinkedTechniquesInput
            label="기술"
            items={group.techniques}
            excludeId={excludeId}
            onChange={(techniques) => update(index, { techniques: techniques.slice(0, RELATED_GROUP_ITEMS_MAX) })}
          />
        </div>
      ))}

      <button
        type="button"
        disabled={groups.length >= RELATED_GROUPS_MAX}
        onClick={() => onChange([...groups, { title: '', techniques: [] }])}
        className="inline-flex h-10 w-full items-center justify-center rounded-md border border-dashed border-input text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
      >
        <Plus className="mr-2 h-4 w-4" />
        목록 추가하기
      </button>
    </div>
  );
}
