'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Edit, Save, X } from 'lucide-react';
import { MySkillsSection } from '@/components/profile/MySkillsSection';
import { MyRequestsSection } from '@/components/profile/MyRequestsSection';

interface ProfileData {
  email: string;
  nickname: string;
  role: 'user' | 'admin';
  level: 'white' | 'blue' | 'purple' | 'brown' | 'black';
  stripe: number;
  period?: string;
  createdAt: string;
}

const LEVEL_LABELS: Record<ProfileData['level'], string> = {
  white: '화이트 벨트',
  blue: '블루 벨트',
  purple: '퍼플 벨트',
  brown: '브라운 벨트',
  black: '블랙 벨트',
};

const LEVEL_OPTIONS: ProfileData['level'][] = ['white', 'blue', 'purple', 'brown', 'black'];

const MAX_STRIPES_BY_LEVEL: Record<ProfileData['level'], number> = {
  white: 4,
  blue: 4,
  purple: 4,
  brown: 4,
  black: 6,
};

function toDateInputValue(period?: string): string {
  if (!period) return '';
  return period.slice(0, 10);
}

function getTrainingDuration(period: string): { years: number; days: number } {
  const start = new Date(period);
  const today = new Date();
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const years = todayMidnight.getFullYear() - startMidnight.getFullYear() + 1;
  const days = Math.floor((todayMidnight.getTime() - startMidnight.getTime()) / 86400000) + 1;
  return { years, days };
}

export default function ProfilePage() {
  const router = useRouter();
  const { status } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [editForm, setEditForm] = useState({
    level: 'white' as ProfileData['level'],
    stripe: 0,
    period: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    async function fetchProfile() {
      if (status !== 'authenticated') return;
      try {
        const res = await fetch('/api/user/me');
        const data = await res.json();
        if (data.success) {
          setProfile(data.data);
        } else {
          setError(data.error || '프로필을 불러오지 못했습니다.');
        }
      } catch {
        setError('오류가 발생했습니다.');
      }
    }
    fetchProfile();
  }, [status]);

  function handleEdit() {
    if (!profile) return;
    setEditForm({
      level: profile.level,
      stripe: profile.stripe,
      period: toDateInputValue(profile.period),
    });
    setSaveError('');
    setIsEditing(true);
  }

  function handleCancel() {
    setSaveError('');
    setIsEditing(false);
  }

  function handleLevelChange(level: ProfileData['level']) {
    setEditForm((prev) => ({
      ...prev,
      level,
      stripe: Math.min(prev.stripe, MAX_STRIPES_BY_LEVEL[level]),
    }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/user/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: editForm.level,
          stripe: editForm.stripe,
          period: editForm.period,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProfile((prev) =>
          prev
            ? { ...prev, level: data.data.level, stripe: data.data.stripe, period: data.data.period }
            : prev
        );
        setIsEditing(false);
      } else {
        setSaveError(data.error || '저장하지 못했습니다.');
      }
    } catch {
      setSaveError('오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading' || (status === 'authenticated' && !profile && !error)) {
    return <div className="p-8">Loading...</div>;
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <div className="container max-w-lg py-6 lg:py-10">
      <h1 className="text-3xl font-bold mb-6">내 정보</h1>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-md mb-6">
          {error}
        </div>
      )}

      {profile && (
        <div className="space-y-4 rounded-lg border p-6">
          {!isEditing && (
            <div className="flex justify-end">
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Edit className="h-3.5 w-3.5" />
                수정
              </button>
            </div>
          )}

          <div className="flex justify-between border-b pb-3">
            <span className="text-muted-foreground">닉네임</span>
            <span className="font-medium">{profile.nickname}</span>
          </div>
          <div className="flex justify-between border-b pb-3">
            <span className="text-muted-foreground">이메일</span>
            <span className="font-medium">{profile.email}</span>
          </div>

          {isEditing ? (
            <>
              <div className="space-y-2 border-b pb-3">
                <label className="block text-sm text-muted-foreground">벨트 등급</label>
                <select
                  value={editForm.level}
                  onChange={(e) => handleLevelChange(e.target.value as ProfileData['level'])}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {LEVEL_OPTIONS.map((level) => (
                    <option key={level} value={level}>
                      {LEVEL_LABELS[level]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 border-b pb-3">
                <label className="block text-sm text-muted-foreground">그랄</label>
                <select
                  value={editForm.stripe}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, stripe: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {Array.from({ length: MAX_STRIPES_BY_LEVEL[editForm.level] + 1 }, (_, n) => n).map((n) => (
                    <option key={n} value={n}>
                      {n}그랄
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-muted-foreground">수련 시작일</label>
                <input
                  type="date"
                  value={editForm.period}
                  max={toDateInputValue(new Date().toISOString())}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, period: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {saveError && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                  {saveError}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between border-b pb-3">
                <span className="text-muted-foreground">벨트 등급</span>
                <span className="font-medium">
                  {LEVEL_LABELS[profile.level]} · 그랄 {profile.stripe}개
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">수련 시작일</span>
                <span className="font-medium text-right">
                  {profile.period ? (
                    <>
                      {new Date(profile.period).toLocaleDateString('ko-KR')}
                      <br />
                      <span className="text-sm text-muted-foreground">
                        {(() => {
                          const { years, days } = getTrainingDuration(profile.period as string);
                          return `${years}년차 (총 ${days}일째)`;
                        })()}
                      </span>
                    </>
                  ) : (
                    '미입력'
                  )}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {profile && <MySkillsSection />}
      {profile && <MyRequestsSection />}
    </div>
  );
}
