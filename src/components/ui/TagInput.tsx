'use client';

import { useState, KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TagSuggestion {
  tag: string;
  count?: number;
}

interface TagInputProps {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
  // 자동완성 후보 (예: 기존 기술에 쓰인 Role Tag). 주어지면 후보에 없는 태그는 "새 태그"로 표시한다.
  suggestions?: TagSuggestion[];
  // 입력값 표기 통일 (예: 소문자/언더스코어). 중복 판정도 이 결과로 한다.
  normalize?: (value: string) => string;
}

export function TagInput({
  label,
  tags,
  onChange,
  placeholder = '입력 후 Enter',
  className,
  suggestions,
  normalize,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [focused, setFocused] = useState(false);

  const normalizeValue = (value: string) => (normalize ? normalize(value) : value.trim());
  const knownTags = new Set((suggestions ?? []).map((s) => s.tag));
  const unknownTags = suggestions && suggestions.length > 0 ? tags.filter((t) => !knownTags.has(t)) : [];

  const query = normalizeValue(inputValue);
  const matches =
    suggestions && focused
      ? suggestions
          .filter((s) => !tags.includes(s.tag) && (!query || s.tag.includes(query)))
          .slice(0, 8)
      : [];

  const addValue = (raw: string) => {
    const value = normalizeValue(raw);
    if (value && !tags.includes(value)) {
      onChange([...tags, value]);
    }
    setInputValue('');
  };

  const addTag = () => addValue(inputValue);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Only add tag if not composing (prevents Korean input bug)
      if (!isComposing) {
        addTag();
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      // Remove last tag when backspace is pressed on empty input
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className={cn('space-y-2', className)}>
      <label className="block text-sm font-medium">{label}</label>
      <div className="flex gap-2">
        <div className="flex-1 flex flex-wrap gap-2 p-3 border border-input rounded-md bg-background focus-within:ring-2 focus-within:ring-ring transition-all">
          {tags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent/20 text-accent text-sm font-medium border border-accent/30"
            >
              {tag}
              {unknownTags.includes(tag) && (
                <span className="text-[10px] font-normal text-amber-600">새 태그</span>
              )}
              <button
                type="button"
                onClick={() => removeTag(index)}
                className="hover:bg-accent/30 rounded-full p-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={tags.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[120px] outline-none bg-transparent text-sm placeholder:text-muted-foreground"
          />
        </div>
        <button
          type="button"
          onClick={addTag}
          className="flex items-center justify-center h-[46px] px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
          title="추가"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {matches.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="추천 태그">
          {matches.map((s) => (
            <li key={s.tag}>
              <button
                type="button"
                // blur로 목록이 사라지기 전에 선택되도록 mousedown에서 처리
                onMouseDown={(e) => {
                  e.preventDefault();
                  addValue(s.tag);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-0.5 text-xs hover:bg-accent/20"
              >
                {s.tag}
                {s.count !== undefined && <span className="text-muted-foreground">{s.count}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {unknownTags.length > 0 && (
        <p className="text-xs text-amber-600">
          기존 기술에 없는 새 태그입니다: {unknownTags.join(', ')} — 비슷한 기존 태그가 있다면 그것을 써주세요.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Enter 키 또는 추가 버튼으로 추가, 태그를 클릭하여 삭제
      </p>
    </div>
  );
}
