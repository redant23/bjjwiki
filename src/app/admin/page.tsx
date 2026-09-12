'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface TechniqueRequestListItem {
  _id: string;
  type: 'create' | 'edit';
  status: 'pending' | 'approved' | 'rejected';
  payload: { name?: { ko?: string; en?: string } };
  targetTechniqueId?: { _id: string; name: { ko: string }; slug: string } | null;
  submittedBy: { nickname: string; email: string };
  createdAt: string;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState<TechniqueRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated' && session?.user?.role !== 'admin') {
      router.push('/');
    }
  }, [status, session, router]);

  useEffect(() => {
    async function fetchPending() {
      if (status === 'authenticated' && session?.user?.role === 'admin') {
        try {
          setError('');
          const res = await fetch('/api/technique-requests?status=pending');
          const data = await res.json();
          if (data.success) {
            setRequests(data.data);
          } else {
            setError(data.error || '요청 목록을 불러오지 못했습니다.');
          }
        } catch (err) {
          console.error('Failed to fetch pending requests', err);
          setError('요청 목록을 불러오지 못했습니다.');
        } finally {
          setLoading(false);
        }
      }
    }
    fetchPending();
  }, [status, session]);

  if (status === 'loading' || loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (status !== 'authenticated' || session?.user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="container py-6 lg:py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <div className="text-sm text-muted-foreground">
            Logged in as {session?.user?.email}
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
        >
          Logout
        </button>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-semibold">대기 중인 요청</h2>

        {error && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-md">
            {error}
          </div>
        )}

        {!error && requests.length === 0 ? (
          <p className="text-muted-foreground">검토할 요청이 없습니다.</p>
        ) : (
          <div className="rounded-md border">
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b">
                  <tr className="border-b transition-colors hover:bg-muted/50">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">유형</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">기술명</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">제출자</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">제출일</th>
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">액션</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {requests.map((req) => (
                    <tr key={req._id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 align-middle">
                        {req.type === 'create' ? '신규 등록' : '수정'}
                      </td>
                      <td className="p-4 align-middle font-medium">
                        {req.targetTechniqueId?.name.ko || req.payload.name?.ko || '(제목 없음)'}
                      </td>
                      <td className="p-4 align-middle">{req.submittedBy.nickname}</td>
                      <td className="p-4 align-middle">{new Date(req.createdAt).toLocaleDateString()}</td>
                      <td className="p-4 align-middle text-right">
                        <Link
                          href={`/admin/requests/${req._id}`}
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3"
                        >
                          검토하기
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
