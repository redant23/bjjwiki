'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useSession, signOut } from 'next-auth/react';
import { Home, List, Layers, Plus, User, X, Moon, Sun, LogIn, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/layout/Sidebar';

interface Technique {
  _id: string;
  name: { ko: string; en?: string };
  slug: string;
  parentId?: string;
  pathSlugs: string[];
  children?: Technique[];
  order?: number;
  contentUpdatedAt?: string | null;
}

interface MobileBottomNavProps {
  initialTree: Technique[];
}

type Drawer = 'none' | 'techniques' | 'me';

export function MobileBottomNav({ initialTree }: MobileBottomNavProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === 'admin';
  const [mounted, setMounted] = useState(false);
  const [drawer, setDrawer] = useState<Drawer>('none');

  useEffect(() => {
    setMounted(true);
  }, []);

  // 드로어가 열려있는 동안 뒤 배경 스크롤을 막는다.
  useEffect(() => {
    document.body.style.overflow = drawer === 'none' ? 'unset' : 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [drawer]);

  const registerHref = status === 'unauthenticated' ? '/auth/signup' : '/technique/new';
  const closeDrawer = () => setDrawer('none');

  const items: Array<
    | { key: string; label: string; icon: typeof Home; href: string }
    | { key: string; label: string; icon: typeof Home; onClick: () => void; active: boolean }
  > = [
    { key: 'home', label: '홈', icon: Home, href: '/' },
    {
      key: 'techniques',
      label: '기술목록',
      icon: List,
      onClick: () => setDrawer('techniques'),
      active: drawer === 'techniques',
    },
    { key: 'combo', label: '콤보', icon: Layers, href: '/combo' },
    { key: 'register', label: '기술등록', icon: Plus, href: registerHref },
    {
      key: 'me',
      label: '내 정보',
      icon: User,
      onClick: () => setDrawer('me'),
      active: drawer === 'me',
    },
  ];

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-stretch border-t border-border bg-background md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = 'href' in item ? pathname === item.href : item.active;
          const className = cn(
            'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
            isActive ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
          );

          if ('href' in item) {
            return (
              <Link key={item.key} href={item.href} className={className}>
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          }

          return (
            <button key={item.key} onClick={item.onClick} className={className}>
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* 기술목록 드로어: 데스크톱 사이드바와 동일한 트리를 전체 화면으로 노출 */}
      {drawer === 'techniques' && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-background md:hidden">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
            <span className="font-semibold">기술목록</span>
            <button
              onClick={closeDrawer}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <Sidebar mobile onLinkClick={closeDrawer} initialTree={initialTree} />
          </div>
        </div>
      )}

      {/* 내 정보 드로어: 다크모드 토글 + 로그인/로그아웃 등 계정 관련 액션 */}
      {drawer === 'me' && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-background md:hidden">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
            <span className="font-semibold">내 정보</span>
            <button
              onClick={closeDrawer}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {status === 'authenticated' && (
              <div className="px-1 pb-2 text-sm text-muted-foreground">
                {session?.user?.name} 님
              </div>
            )}

            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {theme === 'dark' ? '라이트 모드' : '다크 모드'}
              </button>
            )}

            {status === 'authenticated' ? (
              <>
                <Link
                  href="/profile"
                  onClick={closeDrawer}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                >
                  <User className="h-4 w-4" />
                  내 정보 보기
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={closeDrawer}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                  >
                    관리자 페이지
                  </Link>
                )}
                <button
                  onClick={() => {
                    closeDrawer();
                    signOut({ callbackUrl: '/' });
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  로그아웃
                </button>
              </>
            ) : (
              <Link
                href="/auth/signin"
                onClick={closeDrawer}
                className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                <LogIn className="h-4 w-4" />
                로그인
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
