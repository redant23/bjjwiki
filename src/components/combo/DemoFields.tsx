'use client';

import { useEffect, useId, useState } from 'react';
import { MAX_PERFORMER_LENGTH, type DemoGearType } from '@/lib/combo-chain';

export interface DemoFormValue {
  performer: string;
  videoUrl: string;
  gearType: DemoGearType;
}

export const EMPTY_DEMO: DemoFormValue = { performer: '', videoUrl: '', gearType: 'unknown' };

let performersCache: string[] | null = null;

/** 기존에 쓰인 시전자 이름(표기 통일 자동완성). 한 번만 받아 둔다. */
export function usePerformers(): string[] {
  const [names, setNames] = useState<string[]>(performersCache ?? []);
  useEffect(() => {
    if (performersCache) return;
    fetch('/api/combos/performers')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          performersCache = json.data;
          setNames(json.data);
        }
      })
      .catch(() => undefined);
  }, []);
  return names;
}

const GEAR_OPTIONS: Array<{ value: DemoGearType; label: string }> = [
  { value: 'gi', label: '기' },
  { value: 'nogi', label: '노기' },
  { value: 'unknown', label: '모름' },
];

interface DemoFieldsProps {
  value: DemoFormValue;
  onChange: (value: DemoFormValue) => void;
  disabled?: boolean;
}

/** 시전자(자동완성) + 영상 링크 + 영상 속 복장. 영상이 없으면 복장은 선택할 수 없다(모름). */
export function DemoFields({ value, onChange, disabled }: DemoFieldsProps) {
  const performers = usePerformers();
  const listId = useId();
  const hasVideo = value.videoUrl.trim().length > 0;

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor={`${listId}-performer`}>
          시전자 (선택)
        </label>
        <input
          id={`${listId}-performer`}
          type="text"
          list={listId}
          value={value.performer}
          maxLength={MAX_PERFORMER_LENGTH}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, performer: e.target.value })}
          placeholder="예: 케네디 마시엘"
          className="w-full rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <datalist id={listId}>
          {performers.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor={`${listId}-video`}>
          영상 링크 (선택)
        </label>
        <input
          id={`${listId}-video`}
          type="text"
          inputMode="url"
          value={value.videoUrl}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              ...value,
              videoUrl: e.target.value,
              gearType: e.target.value.trim() ? value.gearType : 'unknown',
            })
          }
          placeholder="https://www.youtube.com/watch?v=...&t=120s"
          className="w-full rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="mt-1 text-xs text-muted-foreground">시작 시간(&amp;t=)이 있으면 그 지점부터 재생돼요.</p>
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium">영상 속 복장</span>
        <div className="flex gap-2" role="radiogroup" aria-label="영상 속 복장">
          {GEAR_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={value.gearType === option.value}
              disabled={disabled || !hasVideo}
              onClick={() => onChange({ ...value, gearType: option.value })}
              className={`rounded-md border px-4 py-2 text-sm transition-colors disabled:opacity-50 ${
                value.gearType === option.value
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-input text-muted-foreground hover:bg-muted/50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {!hasVideo && (
          <p className="mt-1 text-xs text-muted-foreground">영상 링크를 입력하면 복장을 고를 수 있어요.</p>
        )}
      </div>
    </div>
  );
}
