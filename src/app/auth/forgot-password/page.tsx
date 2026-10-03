'use client';

import { useState } from 'react';
import Link from 'next/link';

const inputClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const buttonClass =
  'inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || '요청을 처리하지 못했습니다.');
        return;
      }

      setSent(true);
    } catch {
      setError('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <div className="mx-auto w-full max-w-sm space-y-6 p-6 border rounded-lg shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">비밀번호 재설정</h1>
          <p className="text-gray-500 dark:text-gray-400">
            가입한 이메일로 재설정 링크를 보내드립니다
          </p>
        </div>
        {sent ? (
          <p className="text-sm text-center">
            입력하신 이메일로 가입된 계정이 있다면 재설정 메일을 보냈습니다.
            메일함을 확인해 주세요. 링크는 1시간 동안 유효합니다.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email">이메일</label>
              <input
                id="email"
                type="email"
                required
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={loading} className={buttonClass}>
              {loading ? '보내는 중...' : '재설정 메일 보내기'}
            </button>
          </form>
        )}
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/auth/signin" className="underline hover:text-foreground">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  );
}
