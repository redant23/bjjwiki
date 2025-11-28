'use client';

import { useEffect, useState, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  _id: string;
  name: { ko: string; en?: string };
  slug: string;
  pathSlugs: string[];
  primaryRole: string;
  type: string;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/techniques?search=${encodeURIComponent(query)}&fields=light`);
        const data = await res.json();
        if (data.success) {
          setResults(data.data);
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleSelect = (path: string) => {
    onClose();
    router.push(path);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-2xl bg-background rounded-lg shadow-2xl border border-border overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header / Input */}
        <div className="flex items-center px-4 py-3 border-b border-border">
          <Search className="h-5 w-5 text-muted-foreground mr-3" />
          <input
            ref={inputRef}
            type="text"
            placeholder="기술 검색..."
            className="flex-1 bg-transparent border-none outline-none text-lg placeholder:text-muted-foreground"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading ? (
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          ) : (
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="overflow-y-auto p-2">
          {results.length > 0 ? (
            <div className="space-y-1">
              {results.map((result) => (
                <button
                  key={result._id}
                  onClick={() => handleSelect(`/technique/${[...(result.pathSlugs || []), result.slug].join('/')}`)}
                  className="w-full flex items-center px-4 py-3 text-left hover:bg-muted/50 rounded-md group transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {result.name.ko}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {result.name.en && <span className="mr-2">{result.name.en}</span>}
                      <span className="capitalize bg-muted px-1.5 py-0.5 rounded text-[10px]">
                        {result.primaryRole}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Level {result.pathSlugs.length + 1}
                  </div>
                </button>
              ))}
            </div>
          ) : query.trim() ? (
            <div className="py-12 text-center text-muted-foreground">
              {!loading && '검색 결과가 없습니다.'}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              기술 이름을 입력하세요.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-muted/30 border-t border-border text-xs text-muted-foreground flex justify-between">
          <span>
            <strong>{results.length}</strong> 개의 결과
          </span>
          <span>
            ESC to close
          </span>
        </div>
      </div>
    </div>
  );
}
