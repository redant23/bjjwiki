'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface TechniqueRequestDetail {
  _id: string;
  type: 'create' | 'edit';
  status: 'pending' | 'approved' | 'rejected';
  payload: Record<string, unknown>;
  targetTechniqueId?: (Record<string, unknown> & { _id: string; updatedAt: string }) | null;
  submittedBy: { nickname: string; email: string };
  createdAt: string;
}

const FIELD_LABELS: Record<string, string> = {
  name: '기술명',
  aka: '별칭',
  description: '설명',
  type: '유형',
  primaryRole: '주 역할',
  roleTags: 'Role Tags',
  difficulty: '난이도',
  isCorePosition: '핵심 포지션 여부',
  positionType: '포지션 타입',
  parentId: '상위 기술',
  videos: '영상',
  images: '이미지',
  thumbnailUrl: '썸네일',
};

function stringifyValue(value: unknown): string {
  if (value === undefined || value === null) return '(없음)';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

export default function AdminRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [request, setRequest] = useState<TechniqueRequestDetail | null>(null);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [reviewNote, setReviewNote] = useState('');

  const id = params.id as string;

  useEffect(() => {
    if (status !== 'loading' && session?.user?.role !== 'admin') {
      router.push('/');
    }
  }, [status, session, router]);

  useEffect(() => {
    async function fetchRequest() {
      try {
        const res = await fetch(`/api/technique-requests/${id}`);
        const data = await res.json();
        if (data.success) {
          setRequest(data.data);
        } else {
          setError(data.error || '요청을 불러오지 못했습니다.');
        }
      } catch {
        setError('오류가 발생했습니다.');
      }
    }
    if (id && session?.user?.role === 'admin') fetchRequest();
  }, [id, session]);

  const handleApprove = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/technique-requests/${id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        router.push('/admin');
      } else {
        alert('승인 실패: ' + data.error);
      }
    } catch {
      alert('오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!reviewNote.trim()) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/technique-requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewNote }),
      });
      const data = await res.json();
      if (data.success) {
        router.push('/admin');
      } else {
        alert('반려 실패: ' + data.error);
      }
    } catch {
      alert('오류가 발생했습니다.');
    } finally {
      setProcessing(false);
      setShowRejectModal(false);
    }
  };

  if (status === 'loading' || (!request && !error)) {
    return <div className="p-8">Loading...</div>;
  }

  if (error || !request) {
    return <div className="p-8 text-destructive">{error}</div>;
  }

  const target = request.targetTechniqueId;
  const isStale =
    request.status === 'pending' &&
    request.type === 'edit' &&
    !!target &&
    new Date(target.updatedAt as string) > new Date(request.createdAt);

  return (
    <div className="container max-w-2xl py-6 lg:py-10 space-y-6">
      <Link href="/admin" className="flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="mr-1 h-4 w-4" />
        요청 목록으로
      </Link>

      <div>
        <h1 className="text-2xl font-bold">
          {request.type === 'create' ? '신규 기술 등록 요청' : '기술 수정 요청'}
        </h1>
        <p className="text-sm text-muted-foreground">
          제출자: {request.submittedBy.nickname} ({request.submittedBy.email}) ·{' '}
          {new Date(request.createdAt).toLocaleString()}
        </p>
      </div>

      {isStale && (
        <div className="p-4 bg-amber-100 text-amber-900 rounded-md text-sm">
          관리자가 이 요청 제출 이후 이 기술을 직접 수정했습니다. 아래 &quot;변경 전&quot; 값은
          최신 상태를 기준으로 합니다.
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(request.payload).map(([key, value]) => (
          <div key={key} className="border rounded-md p-4 space-y-2">
            <div className="font-semibold text-sm">{FIELD_LABELS[key] || key}</div>
            {request.type === 'edit' && (
              <div className="text-sm">
                <div className="text-muted-foreground">변경 전</div>
                <pre className="whitespace-pre-wrap bg-muted/30 rounded p-2">
                  {stringifyValue(target ? target[key] : undefined)}
                </pre>
              </div>
            )}
            <div className="text-sm">
              <div className="text-muted-foreground">{request.type === 'edit' ? '변경 후' : '내용'}</div>
              <pre className="whitespace-pre-wrap bg-muted/30 rounded p-2">
                {stringifyValue(value)}
              </pre>
            </div>
          </div>
        ))}
      </div>

      {request.status === 'pending' ? (
        <div className="flex gap-2">
          <button
            onClick={handleApprove}
            disabled={processing}
            className="rounded-md bg-green-600 text-white hover:bg-green-700 h-10 px-4 disabled:opacity-50"
          >
            승인
          </button>
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={processing}
            className="rounded-md bg-red-600 text-white hover:bg-red-700 h-10 px-4 disabled:opacity-50"
          >
            반려
          </button>
        </div>
      ) : (
        <p className="text-muted-foreground">이미 처리된 요청입니다 ({request.status}).</p>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md space-y-4">
            <h3 className="font-semibold">반려 사유</h3>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              className="w-full h-24 rounded-md border border-input p-2 text-sm"
              placeholder="반려 사유를 입력하세요"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="rounded-md bg-muted px-4 py-2 text-sm"
              >
                취소
              </button>
              <button
                onClick={handleReject}
                disabled={!reviewNote.trim() || processing}
                className="rounded-md bg-red-600 text-white px-4 py-2 text-sm disabled:opacity-50"
              >
                반려 확정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
