'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { GoogleAnalytics } from '@next/third-parties/google';

// GA4 로더. NEXT_PUBLIC_GA_ID가 없으면(로컬/Preview) 아무것도 렌더링하지 않는다.
// /admin 경로에서는 로드하지 않고, 다른 페이지에서 이미 로드된 뒤 /admin으로
// 클라이언트 이동하는 경우에도 전송되지 않도록 GA 비활성 플래그를 켠다.
export function Analytics({ gaId }: { gaId?: string }) {
  const pathname = usePathname();
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');

  useEffect(() => {
    if (!gaId) return;
    (window as unknown as Record<string, boolean>)[`ga-disable-${gaId}`] = isAdmin;
  }, [gaId, isAdmin]);

  if (!gaId || isAdmin) return null;
  return <GoogleAnalytics gaId={gaId} />;
}
