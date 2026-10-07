'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { TechniqueParentPicker } from '@/components/ui/TechniqueParentPicker';

export interface LinkedTechnique {
  _id: string;
  name: { ko: string };
}

interface LinkedTechniquesInputProps {
  label: string;
  items: LinkedTechnique[];
  onChange: (items: LinkedTechnique[]) => void;
  // 자기 자신은 연결할 수 없다 (수정 폼에서 지정).
  excludeId?: string;
}

// "이 기술에서 이어지는" 스윕/서브미션/이스케이프처럼 다른 기술을 여러 개 연결하는 입력.
export function LinkedTechniquesInput({ label, items, onChange, excludeId }: LinkedTechniquesInputProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">{label}</label>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item._id}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent/20 text-accent text-sm font-medium border border-accent/30"
          >
            {item.name.ko}
            <button
              type="button"
              onClick={() => onChange(items.filter((i) => i._id !== item._id))}
              className="hover:bg-accent/30 rounded-full p-0.5 transition-colors"
              title="삭제"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-input px-2.5 py-1 text-sm hover:bg-accent hover:text-accent-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          기술 추가
        </button>
      </div>
      <TechniqueParentPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        hideNoneOption
        excludeId={excludeId}
        onSelect={(technique) => {
          if (technique && !items.some((i) => i._id === technique._id)) {
            onChange([...items, { _id: technique._id, name: { ko: technique.name.ko } }]);
          }
        }}
      />
    </div>
  );
}
