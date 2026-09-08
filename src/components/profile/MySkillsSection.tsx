'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, X } from 'lucide-react';

type SkillStatus = 'interested' | 'practicing' | 'frequently_used' | 'signature';

interface SkillEntry {
  technique: { _id: string; slug: string; name: { ko: string; en?: string }; pathSlugs: string[] };
  status: SkillStatus | null;
  isFavorite: boolean;
}

const STATUS_GROUPS: { value: SkillStatus; label: string }[] = [
  { value: 'interested', label: '흥미생김' },
  { value: 'practicing', label: '연습중' },
  { value: 'frequently_used', label: '즐겨씀' },
  { value: 'signature', label: '나를 대표하는 기술' },
];

function techniqueHref(technique: SkillEntry['technique']) {
  return `/technique/${[...(technique.pathSlugs || []), technique.slug].join('/')}`;
}

export function MySkillsSection() {
  const [skills, setSkills] = useState<SkillEntry[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchSkills() {
      try {
        const res = await fetch('/api/user/me/skills');
        const data = await res.json();
        if (data.success) {
          setSkills(data.data);
        } else {
          setError(data.error || '내 기술을 불러오지 못했습니다.');
        }
      } catch {
        setError('오류가 발생했습니다.');
      }
    }
    fetchSkills();
  }, []);

  async function updateSkill(techniqueId: string, update: { status?: SkillStatus | null; isFavorite?: boolean }) {
    try {
      const res = await fetch(`/api/user/me/skills/${techniqueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      const data = await res.json();
      if (!data.success) return;

      setSkills((prev) => {
        if (!prev) return prev;
        return prev
          .map((entry) =>
            entry.technique._id === techniqueId
              ? {
                  ...entry,
                  status: update.status !== undefined ? update.status : entry.status,
                  isFavorite: update.isFavorite !== undefined ? update.isFavorite : entry.isFavorite,
                }
              : entry
          )
          .filter((entry) => entry.status !== null || entry.isFavorite);
      });
    } catch {
      setError('오류가 발생했습니다.');
    }
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-md mt-6">
        {error}
      </div>
    );
  }

  if (!skills) {
    return <div className="mt-6 text-muted-foreground">불러오는 중...</div>;
  }

  const favorites = skills.filter((s) => s.isFavorite);

  return (
    <div className="mt-10 space-y-8">
      <h2 className="text-2xl font-bold">내 기술</h2>

      {skills.length === 0 && (
        <p className="text-muted-foreground">
          아직 분류한 기술이 없습니다. 기술 상세 페이지에서 추가해보세요.
        </p>
      )}

      {STATUS_GROUPS.map((group) => {
        const items = skills.filter((s) => s.status === group.value);
        if (items.length === 0) return null;
        return (
          <div key={group.value}>
            <h3 className="text-lg font-semibold mb-3">{group.label}</h3>
            <ul className="space-y-2">
              {items.map((entry) => (
                <li
                  key={entry.technique._id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <Link href={techniqueHref(entry.technique)} className="hover:underline">
                    {entry.technique.name.ko}
                  </Link>
                  <button
                    onClick={() => updateSkill(entry.technique._id, { status: null })}
                    aria-label="분류 해제"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {favorites.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">좋아하는 기술</h3>
          <ul className="space-y-2">
            {favorites.map((entry) => (
              <li
                key={entry.technique._id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <Link href={techniqueHref(entry.technique)} className="hover:underline">
                  {entry.technique.name.ko}
                </Link>
                <button
                  onClick={() => updateSkill(entry.technique._id, { isFavorite: false })}
                  aria-label="좋아요 해제"
                  className="text-destructive hover:text-muted-foreground"
                >
                  <Heart className="h-4 w-4 fill-current" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
