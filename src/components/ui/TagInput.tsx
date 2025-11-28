'use client';

import { useState, KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagInputProps {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function TagInput({ label, tags, onChange, placeholder = '입력 후 Enter', className }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isComposing, setIsComposing] = useState(false);

  const addTag = () => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && !tags.includes(trimmedValue)) {
      onChange([...tags, trimmedValue]);
      setInputValue('');
    }
  };

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
      <p className="text-xs text-muted-foreground">
        Enter 키 또는 추가 버튼으로 추가, 태그를 클릭하여 삭제
      </p>
    </div>
  );
}
