'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface MyRequestItem {
  _id: string;
  type: 'create' | 'edit';
  status: 'pending' | 'approved' | 'rejected';
  payload: { name?: { ko?: string; en?: string } };
  targetTechniqueId?: { _id: string; name: { ko: string }; slug: string; pathSlugs?: string[] } | null;
  reviewNote?: string;
  createdAt: string;
}

const STATUS_LABELS: Record<MyRequestItem['status'], string> = {
  pending: '대기중',
  approved: '승인됨',
  rejected: '반려됨',
};

const STATUS_STYLES: Record<MyRequestItem['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export function MyRequestsSection() {
  const [requests, setRequests] = useState<MyRequestItem[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchRequests() {
      try {
        const res = await fetch('/api/technique-requests?mine=1');
        const data = await res.json();
        if (data.success) {
          setRequests(data.data);
        } else {
          setError(data.error || '요청 내역을 불러오지 못했습니다.');
        }
      } catch {
        setError('오류가 발생했습니다.');
      }
    }
    fetchRequests();
  }, []);

  if (error && !requests) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-md mt-6">
        {error}
      </div>
    );
  }

  if (!requests) {
    return <div className="mt-6 text-muted-foreground">불러오는 중...</div>;
  }

  return (
    <div className="mt-10 space-y-4">
      <h2 className="text-2xl font-bold">내 요청</h2>

      {requests.length === 0 && (
        <p className="text-muted-foreground">제출한 등록/수정 요청이 없습니다.</p>
      )}

      <ul className="space-y-2">
        {requests.map((req) => {
          const name = req.targetTechniqueId?.name.ko || req.payload.name?.ko || '(제목 없음)';
          return (
            <li key={req._id} className="rounded-md border p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {req.type === 'create' ? '신규 등록' : '수정'} · {name}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[req.status]}`}>
                  {STATUS_LABELS[req.status]}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(req.createdAt).toLocaleString()}
              </div>
              {req.status === 'rejected' && req.reviewNote && (
                <div className="text-sm text-destructive">사유: {req.reviewNote}</div>
              )}
              {req.status === 'approved' && req.targetTechniqueId && (
                <Link
                  href={`/technique/${[...(req.targetTechniqueId.pathSlugs || []), req.targetTechniqueId.slug].join('/')}`}
                  className="text-sm text-primary hover:underline"
                >
                  기술 보러가기
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
