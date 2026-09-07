'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

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

export default function ProfilePage() {
  const router = useRouter();
  const { status } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');

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
          <div className="flex justify-between border-b pb-3">
            <span className="text-muted-foreground">닉네임</span>
            <span className="font-medium">{profile.nickname}</span>
          </div>
          <div className="flex justify-between border-b pb-3">
            <span className="text-muted-foreground">이메일</span>
            <span className="font-medium">{profile.email}</span>
          </div>
          <div className="flex justify-between border-b pb-3">
            <span className="text-muted-foreground">벨트 등급</span>
            <span className="font-medium">
              {LEVEL_LABELS[profile.level]} · 그랄 {profile.stripe}개
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">수련 시작일</span>
            <span className="font-medium">
              {profile.period ? new Date(profile.period).toLocaleDateString('ko-KR') : '미입력'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
