'use client';

import Link from 'next/link';
import { Plus, Moon, Sun, Menu, X, Search } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { SearchModal } from '@/components/ui/SearchModal';
import { Sidebar } from '@/components/layout/Sidebar';

interface Technique {
  _id: string;
  name: { ko: string; en?: string };
  slug: string;
  parentId?: string;
  pathSlugs: string[];
  children?: Technique[];
  order?: number;
  level?: number;
}

interface NavbarClientProps {
  initialTree: Technique[];
}

export function NavbarClient({ initialTree }: NavbarClientProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Enable keyboard shortcut
  useSearchShortcut(() => setIsSearchOpen(true));

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 max-w-screen-2xl items-center px-4 sm:px-6 lg:px-8">
          {/* Mobile Menu Toggle (Left) */}
          <div className="mr-4 md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
              <span className="sr-only">Toggle Menu</span>
            </button>
          </div>

          {/* Logo */}
          <div className="mr-4 flex items-center">
            <Link href="/" className="mr-6 flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <span className="font-bold text-lg tracking-tight text-foreground">
                BJJ Wiki
              </span>
            </Link>
          </div>

          {/* Search Bar (Desktop) */}
          <div className="hidden md:flex flex-1 items-center justify-center mx-auto">
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
            {/* Search Icon (Mobile) */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="md:hidden inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground h-9 w-9"
            >
              <Search className="h-5 w-5" />
            </button>

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
            <Link
              href="/technique/new"
              className="inline-flex text-primary items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-accent text-accent-foreground hover:bg-accent/90 h-9 px-4 py-2"
            >
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">기술 등록</span>
              <span className="sm:hidden">등록</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-background md:hidden pt-14 animate-in slide-in-from-left-1/2 duration-200">
          <Sidebar mobile onLinkClick={() => setIsMobileMenuOpen(false)} initialTree={initialTree} />
        </div>
      )}

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
