'use client';

import Link from 'next/link';
import { Plus, Moon, Sun, Search } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { SearchModal } from '@/components/ui/SearchModal';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { LogoMark } from '@/components/brand/Logo';

export function NavbarClient() {
  const { theme, setTheme } = useTheme();
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === 'admin';
  const [mounted, setMounted] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Enable keyboard shortcut
  useSearchShortcut(() => setIsSearchOpen(true));

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* Desktop 네비바: 기존 전체 구성. 모바일은 하단 탭바(MobileBottomNav)와
            아래의 축약 바가 그 역할을 대신하므로 md 이상에서만 노출한다. */}
        <div className="container mx-auto hidden h-14 max-w-screen-2xl items-center px-4 sm:px-6 lg:px-8 md:flex">
          {/* Logo */}
          <div className="mr-4 flex items-center">
            <Link href="/" aria-label="ossground" className="mr-6 flex items-center hover:opacity-80 transition-opacity">
              <LogoMark className="h-8 text-foreground" />
            </Link>
          </div>

          {/* Primary Nav (Desktop) */}
          <nav className="flex items-center gap-1 mr-4">
            <Link
              href="/combo"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 px-3"
            >
              콤보
            </Link>
          </nav>

          {/* Search Bar (Desktop) */}
          <div className="flex flex-1 items-center justify-center mx-auto">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex relative h-9 max-w-[600px] w-full items-center justify-start rounded-md border border-input bg-muted/50 px-4 py-2 text-sm text-muted-foreground shadow-sm hover:bg-muted transition-colors"
            >
              <Search className="mr-2 h-4 w-4 flex-shrink-0" />
              <span className="truncate w-full">기술 검색...</span>
              <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>
          </div>

          {/* Right Actions */}
          <div className="flex flex-1 items-center justify-end space-x-2 max-w-fit">
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-primary hover:text-primary-foreground h-9 w-9"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </button>
            )}
            {status !== 'loading' && (
              <Link
                href={status === 'unauthenticated' ? '/auth/signup' : '/technique/new'}
                className="inline-flex text-primary items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-accent text-accent-foreground hover:bg-accent/90 h-9 px-4 py-2"
              >
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">기술 등록</span>
                <span className="sm:hidden">등록</span>
              </Link>
            )}
            {status === 'authenticated' && <NotificationBell />}
            {status === 'authenticated' && isAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center justify-center rounded-md text-xs font-semibold bg-primary text-primary-foreground h-6 px-2 hover:bg-primary/90"
              >
                관리자
              </Link>
            )}
            {status === 'authenticated' && (
              <>
                <Link
                  href="/profile"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground h-9 px-3"
                >
                  내 정보
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground h-9 px-3"
                >
                  로그아웃
                </button>
              </>
            )}
            {status === 'unauthenticated' && (
              <Link
                href="/auth/signin"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground h-9 px-3"
              >
                로그인
              </Link>
            )}
          </div>
        </div>

        {/* Mobile 축약 바: 검색/알림 아이콘만. 나머지(콤보, 기술등록, 내 정보,
            다크모드, 로그인/로그아웃)는 MobileBottomNav로 이동했다. */}
        <div className="flex h-14 items-center justify-end gap-1 px-4 md:hidden">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground h-9 w-9"
            aria-label="기술 검색"
          >
            <Search className="h-5 w-5" />
          </button>
          {status === 'authenticated' && <NotificationBell />}
        </div>
      </header>

      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}

// Add keyboard shortcut for search
function useSearchShortcut(onOpen: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpen]);
}
