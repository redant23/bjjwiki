'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, X, ArrowUp, ArrowDown, Upload, Loader2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';

interface SearchResult {
  _id: string;
  name: { ko: string; en?: string };
  slug: string;
  pathSlugs: string[];
  primaryRole: string;
  type: string;
}

interface ChainItem {
  _id: string;
  name: { ko: string; en?: string };
}

export default function NewComboPage() {
  const { status } = useSession();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [chain, setChain] = useState<ChainItem[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timeoutId = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/techniques?search=${encodeURIComponent(query)}&fields=light`);
        const data = await res.json();
        if (data.success) {
          setResults(data.data);
        }
      } catch (error) {
        console.error('Failed to search techniques:', error);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  function addToChain(result: SearchResult) {
    setChain((prev) => [...prev, { _id: result._id, name: result.name }]);
    setQuery('');
    setResults([]);
  }

  function removeFromChain(index: number) {
    setChain((prev) => prev.filter((_, i) => i !== index));
  }

  function moveInChain(index: number, direction: 'up' | 'down') {
    setChain((prev) => {
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });
      setPhotoFile(compressed);
      setPreviewUrl(URL.createObjectURL(compressed));
      setError('');
    } catch (error) {
      console.error('Image compression failed:', error);
      setError('이미지 압축에 실패했습니다.');
    }
  }

  function removePhoto() {
    setPhotoFile(null);
    setPreviewUrl('');
  }

  async function handleSubmit() {
    if (chain.length < 2) return;

    setSaving(true);
    setError('');
    try {
      let photoUrl = '';
      if (photoFile) {
        const formData = new FormData();
        formData.append('file', photoFile);
        formData.append('usage', 'combo_photo');
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadData.success) {
          throw new Error('이미지 업로드에 실패했습니다.');
        }
        photoUrl = uploadData.data.url;
      }

      const res = await fetch('/api/combos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          techniques: chain.map((c) => c._id),
          videoUrl: videoUrl.trim() || undefined,
          photoUrl: photoUrl || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/combo/${data.data._id}`);
      } else {
        setError(data.error || '등록하지 못했습니다.');
      }
    } catch (err) {
      console.error(err);
      setError('오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (status !== 'authenticated') {
    return null;
  }

  return (
    <div className="container max-w-2xl py-6 lg:py-10">
      <h1 className="text-3xl font-bold mb-6">콤보 등록</h1>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">기술 체인</label>

          {chain.length > 0 && (
            <ul className="space-y-2 mb-3">
              {chain.map((item, index) => (
                <li
                  key={`${item._id}-${index}`}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <span>
                    <span className="text-muted-foreground mr-2">{index + 1}.</span>
                    {item.name.ko}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveInChain(index, 'up')}
                      disabled={index === 0}
                      className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => moveInChain(index, 'down')}
                      disabled={index === chain.length - 1}
                      className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeFromChain(index)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {chain.length < 2 && (
            <p className="text-sm text-muted-foreground mb-3">
              기술을 최소 2개 이상 추가해야 합니다. (현재 {chain.length}개)
            </p>
          )}

          <div className="relative">
            <div className="flex items-center border rounded-md px-3">
              <Search className="h-4 w-4 text-muted-foreground mr-2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="기술 검색 후 추가..."
                className="flex-1 py-2 bg-transparent outline-none text-sm"
              />
              {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>

            {results.length > 0 && (
              <ul className="absolute z-10 w-full mt-1 rounded-md border bg-background shadow-lg max-h-64 overflow-y-auto">
                {results.map((result) => (
                  <li key={result._id}>
                    <button
                      onClick={() => addToChain(result)}
                      className="w-full text-left px-4 py-2 hover:bg-muted/50 text-sm"
                    >
                      {result.name.ko}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">시연 영상 URL (선택)</label>
          <input
            type="text"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">시연 사진 (선택)</label>
          {previewUrl ? (
            <div className="relative w-full max-w-xs">
              <img src={previewUrl} alt="미리보기" className="rounded-md border w-full" />
              <button
                onClick={removePhoto}
                className="absolute top-2 right-2 p-1 rounded-full bg-background/80 hover:bg-destructive/10 text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 w-fit px-4 py-2 border border-dashed rounded-md cursor-pointer text-sm text-muted-foreground hover:bg-muted/30">
              <Upload className="h-4 w-4" />
              사진 선택
              <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
            </label>
          )}
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Link
            href="/combo"
            className="flex items-center px-4 py-2 rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            취소
          </Link>
          <button
            onClick={handleSubmit}
            disabled={chain.length < 2 || saving}
            className="flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? '등록 중...' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}
