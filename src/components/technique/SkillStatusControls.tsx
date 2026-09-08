'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Heart } from 'lucide-react';

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

  function handleStatusClick(value: SkillStatus) {
    const nextStatus = skillStatus === value ? null : value;
    updateSkill({ status: nextStatus });
  }

  function handleFavoriteClick() {
    updateSkill({ isFavorite: !isFavorite });
  }

  if (sessionStatus !== 'authenticated' || !loaded) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-4 border-y border-border">
      {STATUS_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={saving}
          onClick={() => handleStatusClick(option.value)}
          className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
            skillStatus === option.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          }`}
        >
          {option.label}
        </button>
      ))}
      <button
        type="button"
        disabled={saving}
        onClick={handleFavoriteClick}
        aria-label="좋아하는 기술로 표시"
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
          isFavorite
            ? 'bg-destructive/10 text-destructive'
            : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
      >
        <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
        좋아함
      </button>
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </div>
  );
}
