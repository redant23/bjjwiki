'use client';

import { Analytics } from '@vercel/analytics/next';

// Vercel Web Analytics. 관리자 본인 방문이 섞이지 않도록 /admin 경로는 전송하지 않는다.
export function VercelAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        const { pathname } = new URL(event.url);
        return pathname === '/admin' || pathname.startsWith('/admin/') ? null : event;
      }}
    />
  );
}
