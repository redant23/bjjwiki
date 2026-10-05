'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { QUALITY_ISSUE_LABELS, QualityIssue } from '@/lib/technique-quality';
import { ROLE_LABELS } from '@/lib/technique-request-format';

interface QualityItem {
  _id: string;
  name: string;
  href: string;
  primaryRole: string;
  status: 'draft' | 'published' | 'archived';
  issues: QualityIssue[];
  headingCount: number;
}

interface QualityReport {
  total: number;
  incomplete: number;
  counts: Record<QualityIssue, number>;
  items: QualityItem[];
}

type StatusFilter = 'published' | 'draft' | 'all';

const ISSUES = Object.keys(QUALITY_ISSUE_LABELS) as QualityIssue[];

export default function AdminQualityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('published');
  const [issueFilter, setIssueFilter] = useState<QualityIssue | null>(null);
  const [report, setReport] = useState<QualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = status === 'authenticated' && session?.user?.role === 'admin';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated' && session?.user?.role !== 'admin') {
      router.push('/');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/admin/quality?status=${statusFilter}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          setReport(data.data);
        } else {
          setError(data.error || '불러오지 못했습니다.');
        }
      } catch {
        if (!cancelled) setError('불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, statusFilter]);

  if (status === 'loading') {
    return <div className="p-8">Loading...</div>;
  }
  if (!isAdmin) {
    return null;
  }

  const items = (report?.items ?? []).filter((i) => !issueFilter || i.issues.includes(issueFilter));

  return (
    <div className="container py-6 lg:py-10">
      <Link href="/admin" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="mr-1 h-4 w-4" />
        관리자 대시보드
      </Link>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">미완성 기술</h1>
        <p className="text-sm text-muted-foreground">
          영상이 없거나, 썸네일이 없거나, 설명의 제목(#)이 2개 이하인 기술입니다.
        </p>
      </div>

      <div className="mb-4 flex gap-2 border-b">
        {([
          ['published', '게시됨'],
          ['draft', '임시저장'],
          ['all', '전체'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              statusFilter === value
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-md">{error}</div>}

      {report && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <button
              onClick={() => setIssueFilter(null)}
              className={`rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 ${
                issueFilter === null ? 'border-primary' : ''
              }`}
            >
              <div className="text-2xl font-bold">
                {report.incomplete}
                <span className="text-sm font-normal text-muted-foreground"> / {report.total}</span>
              </div>
              <div className="text-sm text-muted-foreground">미완성 전체</div>
            </button>
            {ISSUES.map((issue) => (
              <button
                key={issue}
                onClick={() => setIssueFilter(issueFilter === issue ? null : issue)}
                className={`rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 ${
                  issueFilter === issue ? 'border-primary' : ''
                }`}
              >
                <div className="text-2xl font-bold">{report.counts[issue]}</div>
                <div className="text-sm text-muted-foreground">{QUALITY_ISSUE_LABELS[issue]}</div>
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-muted-foreground">불러오는 중...</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground">해당하는 기술이 없습니다.</p>
          ) : (
            <div className="rounded-md border">
              <div className="relative w-full overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="h-12 px-4 text-left font-medium text-muted-foreground">기술명</th>
                      <th className="h-12 px-4 text-left font-medium text-muted-foreground">주 역할</th>
                      <th className="h-12 px-4 text-left font-medium text-muted-foreground">부족한 항목</th>
                      <th className="h-12 px-4 text-right font-medium text-muted-foreground">바로가기</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item._id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="p-4 font-medium">
                          {item.name}
                          {item.status !== 'published' && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">(임시저장)</span>
                          )}
                        </td>
                        <td className="p-4">{ROLE_LABELS[item.primaryRole] || item.primaryRole}</td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1.5">
                            {item.issues.map((issue) => (
                              <span
                                key={issue}
                                className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                              >
                                {QUALITY_ISSUE_LABELS[issue]}
                                {issue === 'weak_structure' && ` (제목 ${item.headingCount}개)`}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <Link
                            href={item.href}
                            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                          >
                            열어서 보완
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
