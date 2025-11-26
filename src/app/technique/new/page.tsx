'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Upload, X } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { MarkdownEditor } from '@/components/ui/MarkdownEditor';
import { VideoUrlInput } from '@/components/ui/VideoUrlInput';

export default function NewTechniquePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: { ko: '', en: '' },
    aka: { ko: '', en: '' }, // comma separated
    description: { ko: '', en: '' },
    type: 'both',
    primaryRole: 'position',
    difficulty: 1,
    isCorePosition: false,
    positionType: 'neutral',
    parentId: '', // ObjectId
    videoUrls: [''],
    imageUrl: '',
    roleTags: '', // comma separated
  });

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const [parents, setParents] = useState<{ _id: string, name: { ko: string } }[]>([]);

  useEffect(() => {
    // Fetch potential parents (all techniques for now, or filter by positions)
    async function fetchParents() {
      try {
        const res = await fetch('/api/techniques?status=published');
        const data = await res.json();
        if (data.success) {
          setParents(data.data);
        }
      } catch {
        console.error('Failed to fetch parents');
      }
    }
    fetchParents();
  }, []);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);
      setThumbnailFile(compressedFile);
      setPreviewUrl(URL.createObjectURL(compressedFile));
    } catch (error) {
      console.error('Image compression failed:', error);
      setError('이미지 압축에 실패했습니다.');
    }
  };

  const removeImage = () => {
    setThumbnailFile(null);
    setPreviewUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Process data
      let finalImageUrl = formData.imageUrl;

      // Upload image if exists
      if (thumbnailFile) {
        const imageFormData = new FormData();
        imageFormData.append('file', thumbnailFile);
        imageFormData.append('usage', 'technique_thumbnail');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: imageFormData,
        });
        const uploadData = await uploadRes.json();

        if (uploadData.success) {
          finalImageUrl = uploadData.data.url;
        } else {
          throw new Error('Image upload failed');
        }
      }

      const payload = {
        name: formData.name,
        aka: {
          ko: formData.aka.ko.split(',').map(s => s.trim()).filter(Boolean),
          en: formData.aka.en.split(',').map(s => s.trim()).filter(Boolean),
        },
        description: formData.description,
        type: formData.type,
        primaryRole: formData.primaryRole,
        roleTags: formData.roleTags.split(',').map(s => s.trim()).filter(Boolean),
        difficulty: Number(formData.difficulty),
        isCorePosition: formData.isCorePosition,
        positionType: formData.positionType,
        parentId: formData.parentId || null,
        videos: formData.videoUrls.filter(url => url.trim()).map(url => ({ url })),
        images: finalImageUrl ? [{ url: finalImageUrl, isPrimary: true }] : [],
        thumbnailUrl: finalImageUrl,
        status: 'published', // Auto publish for now for ease of testing
      };

      const res = await fetch('/api/techniques', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        const slug = data.data.slug;
        const path = [...(data.data.pathSlugs || []), slug].join('/');
        router.push(`/technique/${path}`);
      } else {
        setError(data.error || '기술 생성에 실패했습니다.');
      }
    } catch {
      setError('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-2xl py-6 lg:py-10">
      <div className="mb-8">
        <Link href="/" className="flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="mr-1 h-4 w-4" />
          홈으로 돌아가기
        </Link>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">새 기술 등록</h1>
          <p className="text-muted-foreground">데이터베이스에 새로운 기술을 추가합니다.</p>
        </div>

        {error && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Thumbnail Image - Moved to top */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
            <h3 className="text-lg font-semibold">썸네일 이미지</h3>
            <div className="flex items-center gap-4">
              {previewUrl ? (
                <div className="relative w-40 aspect-video rounded-md overflow-hidden border border-border">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center w-40 aspect-video rounded-md border border-dashed border-input bg-muted/50">
                  <span className="text-xs text-muted-foreground">이미지 없음</span>
                </div>
              )}
              <div className="flex-1">
                <label
                  htmlFor="thumbnail-upload"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 cursor-pointer"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  이미지 업로드
                </label>
                <input
                  id="thumbnail-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  최대 1MB, 자동 압축됨.
                </p>
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">기본 정보</h3>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">기술명 (한글)</label>
                <input
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.name.ko}
                  onChange={e => setFormData({ ...formData, name: { ...formData.name, ko: e.target.value } })}
                  placeholder="예: 암바"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">기술명 (영어)</label>
                <input
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.name.en}
                  onChange={e => setFormData({ ...formData, name: { ...formData.name, en: e.target.value } })}
                  placeholder="예: Armbar"
                />
              </div>
            </div>
          </div>

          {/* Classification */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">분류</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">유형</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="both">기/노기 공용</option>
                  <option value="gi">기 (도복)</option>
                  <option value="nogi">노기</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">주 역할</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.primaryRole}
                  onChange={e => setFormData({ ...formData, primaryRole: e.target.value })}
                >
                  <option value="position">포지션</option>
                  <option value="guard">가드</option>
                  <option value="submission">서브미션</option>
                  <option value="sweep">스윕</option>
                  <option value="escape">이스케이프</option>
                  <option value="guard_pass">가드 패스</option>
                  <option value="drill">드릴</option>
                  <option value="transition">트랜지션</option>
                  <option value="guard_recovery">가드 리커버리</option>
                  <option value="leg_entry">레그 엔트리</option>
                  <option value="control_hold">컨트롤/홀드</option>
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Role Tags (쉼표로 구분)</label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.roleTags}
                onChange={e => setFormData({ ...formData, roleTags: e.target.value })}
                placeholder="예: backtake, inversion, framing"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">상위 기술 (선택)</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.parentId}
                onChange={e => setFormData({ ...formData, parentId: e.target.value })}
              >
                <option value="">없음 (최상위)</option>
                {parents.map(p => (
                  <option key={p._id} value={p._id}>
                    {p.name.ko}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">내용</h3>
            <div className="grid gap-2">
              <MarkdownEditor
                label="설명 (마크다운 지원)"
                value={formData.description.ko}
                onChange={(val) => setFormData({ ...formData, description: { ...formData.description, ko: val } })}
                placeholder="기술에 대한 상세한 설명을 입력하세요..."
              />
            </div>

            <VideoUrlInput
              urls={formData.videoUrls}
              onChange={(urls) => setFormData({ ...formData, videoUrls: urls })}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
          >
            {loading ? '등록 중...' : '기술 등록하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
