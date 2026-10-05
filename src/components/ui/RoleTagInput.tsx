'use client';

import { useEffect, useState } from 'react';
import { TagInput, TagSuggestion } from '@/components/ui/TagInput';
import { normalizeRoleTag } from '@/lib/technique-form';

interface RoleTagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

// 기존 기술에 쓰인 Role Tag를 많이 쓰인 순으로 추천하고, 표기를 통일(소문자/언더스코어)한다.
export function RoleTagInput({ tags, onChange }: RoleTagInputProps) {
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/techniques/role-tags')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.success) setSuggestions(data.data);
      })
      .catch(() => {
        // 추천 목록이 없어도 입력 자체는 가능해야 한다.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <TagInput
      label="Role Tags"
      tags={tags}
      onChange={onChange}
      placeholder="예: backtake (기존 태그가 추천됩니다)"
      suggestions={suggestions}
      normalize={normalizeRoleTag}
    />
  );
}
