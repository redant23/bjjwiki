'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FIELD_LABELS, getChangedFields, summarizeValue } from '@/lib/technique-request-format';

interface MyRequestItem {
  _id: string;
  type: 'create' | 'edit';
  status: 'pending' | 'approved' | 'rejected';
  payload: { name?: { ko?: string; en?: string } };
  targetTechniqueId?: { _id: string; name: { ko: string }; slug: string; pathSlugs?: string[] } | null;
  reviewNote?: string;
  createdAt: string;
}

interface MyRequestDetail {
  _id: string;
  type: 'create' | 'edit';
  payload: Record<string, unknown>;
  targetTechniqueId?: Record<string, unknown> | null;
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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MyRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

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

  useEffect(() => {
    if (!selectedId) return;
    async function fetchDetail(id: string) {
      setDetailLoading(true);
      setDetailError('');
      try {
        const res = await fetch(`/api/technique-requests/${id}`);
        const data = await res.json();
        if (data.success) {
          setDetail(data.data);
        } else {
          setDetailError(data.error || '상세 내용을 불러오지 못했습니다.');
        }
      } catch {
        setDetailError('오류가 발생했습니다.');
      } finally {
        setDetailLoading(false);
      }
    }
    fetchDetail(selectedId);
  }, [selectedId]);

  const closeModal = () => {
    setSelectedId(null);
    setDetail(null);
    setDetailError('');
  };

  const selectedRequest = requests?.find((r) => r._id === selectedId) || null;
  const changedFields = detail
    ? detail.type === 'edit'
      ? getChangedFields(detail.payload, detail.targetTechniqueId)
      : Object.entries(detail.payload).map(([key, after]) => ({ key, before: undefined, after }))
    : [];

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
              <button
                onClick={() => setSelectedId(req._id)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium hover:underline">
                    {req.type === 'create' ? '신규 등록' : '수정'} · {name}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[req.status]}`}>
                    {STATUS_LABELS[req.status]}
                  </span>
                </div>
              </button>
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

      {selectedId && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-background rounded-lg p-6 w-full max-w-md space-y-4 max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                {selectedRequest?.type === 'create' ? '신규 등록 요청 내용' : '수정 요청 내용'}
              </h3>
              <button
                onClick={closeModal}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                닫기
              </button>
            </div>

            {detailLoading && <p className="text-sm text-muted-foreground">불러오는 중...</p>}
            {detailError && <p className="text-sm text-destructive">{detailError}</p>}

            {detail && !detailLoading && (
              <div className="space-y-3">
                {changedFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">변경된 내용이 없습니다.</p>
                ) : (
                  changedFields.map(({ key, before, after }) => (
                    <div key={key} className="text-sm border-b last:border-0 pb-2 last:pb-0">
                      <div className="font-medium mb-1">{FIELD_LABELS[key] || key}</div>
                      {detail.type === 'edit' ? (
                        <div className="text-muted-foreground">
                          {summarizeValue(key, before)}
                          <span className="mx-1">→</span>
                          <span className="text-foreground">{summarizeValue(key, after)}</span>
                        </div>
                      ) : (
                        <div className="text-foreground">{summarizeValue(key, after)}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
