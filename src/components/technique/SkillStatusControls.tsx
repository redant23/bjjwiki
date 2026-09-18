'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ChevronDown, Heart } from 'lucide-react';

type SkillStatus = 'interested' | 'practicing' | 'frequently_used' | 'signature';

const STATUS_OPTIONS: { value: SkillStatus; label: string }[] = [
  { value: 'interested', label: '흥미생김' },
  { value: 'practicing', label: '연습중' },
  { value: 'frequently_used', label: '즐겨씀' },
  { value: 'signature', label: '나를 대표하는 기술' },
];

interface SkillStatusControlsProps {
  techniqueId: string;
}

export function SkillStatusControls({ techniqueId }: SkillStatusControlsProps) {
  const { status: sessionStatus } = useSession();
  const [skillStatus, setSkillStatus] = useState<SkillStatus | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoaded(false);
    setSkillStatus(null);
    setIsFavorite(false);
    setError('');

    async function fetchSkill() {
      if (sessionStatus !== 'authenticated') {
        setLoaded(true);
        return;
      }
      try {
        const res = await fetch(`/api/user/me/skills/${techniqueId}`);
        const data = await res.json();
        if (data.success) {
          setSkillStatus(data.data.status);
          setIsFavorite(data.data.isFavorite);
        } else {
          setError(data.error || '불러오지 못했습니다.');
        }
      } catch {
        setError('오류가 발생했습니다.');
      } finally {
        setLoaded(true);
      }
    }
    fetchSkill();
  }, [sessionStatus, techniqueId]);

  async function updateSkill(update: { status?: SkillStatus | null; isFavorite?: boolean }) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/user/me/skills/${techniqueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || '저장하지 못했습니다.');
        return;
      }
      if (update.status !== undefined) setSkillStatus(update.status);
      if (update.isFavorite !== undefined) setIsFavorite(update.isFavorite);
    } catch {
      setError('오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  function handleStatusChange(value: string) {
    updateSkill({ status: value ? (value as SkillStatus) : null });
  }

  function handleFavoriteClick() {
    updateSkill({ isFavorite: !isFavorite });
  }

  if (sessionStatus !== 'authenticated' || !loaded) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        disabled={saving}
        onClick={handleFavoriteClick}
        aria-label="좋아하는 기술로 표시"
        aria-pressed={isFavorite}
        className={`flex items-center justify-center px-3 py-1.5 transition-colors disabled:opacity-50 ${
          isFavorite ? 'text-destructive' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
      >
        <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
      </button>

      <div className="relative flex h-full items-center">
        <select
          value={skillStatus ?? ''}
          disabled={saving}
          onChange={(e) => handleStatusChange(e.target.value)}
          aria-label="관심도 선택"
          className="h-full cursor-pointer appearance-none bg-transparent py-1.5 pl-3 pr-7 text-sm font-medium text-foreground focus:outline-none disabled:opacity-50"
        >
          <option value="">관심도 선택</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-muted-foreground" />
      </div>

      {error && (
        <p className="absolute right-0 top-full mt-1 whitespace-nowrap text-xs text-destructive">
          {error}
        </p>
      )}
    </>
  );
}
