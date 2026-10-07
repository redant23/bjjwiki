'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ChevronLeft, ChevronDown, Upload, X, FileText } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { MarkdownEditor } from '@/components/ui/MarkdownEditor';
import { VideoUrlInput } from '@/components/ui/VideoUrlInput';
import { TagInput } from '@/components/ui/TagInput';
import { TechniqueParentPicker } from '@/components/ui/TechniqueParentPicker';
import { RoleTagInput } from '@/components/ui/RoleTagInput';
import { RelatedGroupsEditor, toPayloadGroups, type EditableRelatedGroup } from '@/components/ui/RelatedGroupsEditor';
import { PRIMARY_ROLE_OPTIONS, insertDescriptionTemplate } from '@/lib/technique-form';
import { getFirstYoutubeThumbnail } from '@/lib/youtube';
import { SimilarTechniqueWarning } from '@/components/technique/SimilarTechniqueWarning';
import { isValidSlug, slugify } from '@/lib/technique-slug';

export default function NewTechniquePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: { ko: '', en: '' },
    slug: '', // 관리자 전용, 비우면 자동 생성
    aka: { ko: [] as string[], en: [] as string[] },
    description: { ko: '', en: '' },
    type: 'both',
    primaryRole: '', // 필수. 상위 기술을 고르면 그 기술의 역할로 채워진다.
    difficulty: 1,
    isCorePosition: false,
    positionType: '' as '' | 'top' | 'bottom' | 'neutral', // 미지정이면 저장하지 않음
    parentId: '', // ObjectId
    videoUrls: [''],
    imageUrl: '',
    roleTags: [] as string[],
    relatedGroups: [] as EditableRelatedGroup[],
  });

  // 주 역할이 상위 기술에서 자동으로 채워진 값인지 (직접 고르면 false)
  const [roleInherited, setRoleInherited] = useState(false);
  const [continuous, setContinuous] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ name: string; href?: string } | null>(null);

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const [parentName, setParentName] = useState('');
  const [parentPickerOpen, setParentPickerOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  if (status === 'loading') {
    return <div className="p-8">Loading...</div>;
  }

  if (status === 'unauthenticated') {
    return null;
  }

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

  // 연속 등록: 상위 기술/유형/주 역할은 유지하고 나머지를 비운다.
  const resetForNext = () => {
    setFormData((prev) => ({
      ...prev,
      name: { ko: '', en: '' },
      slug: '',
      aka: { ko: [], en: [] },
      description: { ko: '', en: '' },
      difficulty: 1,
      videoUrls: [''],
      imageUrl: '',
      roleTags: [],
      relatedGroups: [],
    }));
    setThumbnailFile(null);
    setPreviewUrl('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const autoThumbnail = previewUrl ? null : getFirstYoutubeThumbnail(formData.videoUrls);

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

      // 직접 올린 이미지가 없으면 첫 유튜브 영상의 썸네일을 쓴다.
      finalImageUrl = finalImageUrl || getFirstYoutubeThumbnail(formData.videoUrls) || '';

      const payload = {
        name: formData.name,
        aka: {
          ko: formData.aka.ko,
          en: formData.aka.en,
        },
        description: formData.description,
        type: formData.type,
        primaryRole: formData.primaryRole,
        roleTags: formData.roleTags,
        relatedGroups: toPayloadGroups(formData.relatedGroups),
        difficulty: Number(formData.difficulty),
        isCorePosition: formData.isCorePosition,
        ...(formData.positionType && { positionType: formData.positionType }),
        parentId: formData.parentId || null,
        videos: formData.videoUrls.filter(url => url.trim()).map(url => ({ url })),
        images: finalImageUrl ? [{ url: finalImageUrl, isPrimary: true }] : [],
        thumbnailUrl: finalImageUrl,
      };

      const isAdmin = session?.user?.role === 'admin';

      if (isAdmin) {
        const customSlug = formData.slug.trim();
        const res = await fetch('/api/techniques', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            ...(customSlug && { slug: customSlug }),
            status: 'published',
          }),
        });

        const data = await res.json();
        if (data.success) {
          const slug = data.data.slug;
          const path = [...(data.data.pathSlugs || []), slug].join('/');
          if (continuous) {
            resetForNext();
            setLastCreated({ name: data.data.name.ko, href: `/technique/${path}` });
            router.refresh();
            return;
          }
          // Order matters: refresh() before push() gets discarded outright —
          // Next.js's router cancels a pending refresh as soon as a navigate
          // is dispatched. push() first, then refresh() queues the refresh to
          // run after the navigation lands, so it actually refetches the
          // sidebar's data for the new page.
          router.push(`/technique/${path}`);
          router.refresh();
        } else {
          setError(data.error || '기술 생성에 실패했습니다.');
        }
      } else {
        const res = await fetch('/api/technique-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'create', payload }),
        });

        const data = await res.json();
        if (data.success) {
          if (continuous) {
            resetForNext();
            setLastCreated({ name: formData.name.ko });
            return;
          }
          alert('등록 요청이 접수되었습니다. 관리자 확인 후 게시됩니다.');
          router.push('/profile');
        } else {
          setError(data.error || '등록 요청에 실패했습니다.');
        }
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
          <p className="text-muted-foreground">
            {session?.user?.role === 'admin'
              ? '데이터베이스에 새로운 기술을 추가합니다.'
              : '등록 요청을 제출합니다. 관리자 확인 후 게시됩니다.'}
          </p>
        </div>

        {error && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-md">
            {error}
          </div>
        )}

        {lastCreated && (
          <div className="p-4 bg-primary/10 rounded-md text-sm">
            {session?.user?.role === 'admin' ? '등록했습니다' : '등록 요청을 접수했습니다'}:{' '}
            {lastCreated.href ? (
              <Link href={lastCreated.href} className="font-medium underline">
                {lastCreated.name}
              </Link>
            ) : (
              <span className="font-medium">{lastCreated.name}</span>
            )}
            . 이어서 다음 기술을 등록하세요.
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
                autoThumbnail ? (
                  <div className="w-40 aspect-video rounded-md overflow-hidden border border-border">
                    <img src={autoThumbnail} alt="영상 썸네일" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-40 aspect-video rounded-md border border-dashed border-input bg-muted/50">
                    <span className="text-xs text-muted-foreground">이미지 없음</span>
                  </div>
                )
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
                  {autoThumbnail && ' 업로드하지 않으면 유튜브 영상 썸네일이 사용됩니다.'}
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

            {/* AKA (Aliases) */}
            <TagInput
              label="별칭 (A.K.A)"
              tags={formData.aka.ko}
              onChange={(tags) => setFormData({ ...formData, aka: { ...formData.aka, ko: tags } })}
              placeholder="별칭 입력 후 Enter"
            />

            {/* 관리자에게만: 중복/유사 기술 안내 (저장은 막지 않음) */}
            <SimilarTechniqueWarning name={formData.name} aka={formData.aka} />

            {session?.user?.role === 'admin' && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">슬러그 (선택)</label>
                <input
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder={slugify(formData.name.en) || '비우면 영문명에서 자동 생성 (영문명이 없으면 임의 ID)'}
                />
                {formData.slug.trim() && !isValidSlug(formData.slug.trim().toLowerCase()) ? (
                  <p className="text-xs text-destructive">
                    소문자 영문/숫자를 하이픈(-)으로 이은 형태만 가능합니다. (예: triangle-choke)
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    URL에 쓰이는 주소입니다. 등록 후에는 바꾸면 기존 링크가 깨지므로 신중히 정하세요.
                  </p>
                )}
              </div>
            )}
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
                <label className="text-sm font-medium">
                  주 역할 <span className="text-destructive">*</span>
                  {roleInherited && formData.primaryRole && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">상위 기술에서 상속됨</span>
                  )}
                </label>
                <select
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.primaryRole}
                  onChange={e => {
                    setRoleInherited(false);
                    setFormData({ ...formData, primaryRole: e.target.value });
                  }}
                >
                  <option value="" disabled>선택하세요</option>
                  {PRIMARY_ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <RoleTagInput
              tags={formData.roleTags}
              onChange={(roleTags) => setFormData({ ...formData, roleTags })}
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">난이도 (1~10)</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.difficulty}
                  onChange={e => setFormData({ ...formData, difficulty: Number(e.target.value) })}
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">탑/바텀</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.positionType}
                  onChange={e => setFormData({ ...formData, positionType: e.target.value as typeof formData.positionType })}
                >
                  <option value="">미지정</option>
                  <option value="top">탑</option>
                  <option value="bottom">바텀</option>
                  <option value="neutral">중립</option>
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">상위 기술 (선택)</label>
              <button
                type="button"
                onClick={() => setParentPickerOpen(true)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className={parentName ? '' : 'text-muted-foreground'}>
                  {parentName || '없음 (최상위)'}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">내용</h3>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, description: { ...formData.description, ko: insertDescriptionTemplate(formData.description.ko) } })}
                className="inline-flex w-fit items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <FileText className="h-4 w-4" />
                설명 템플릿 삽입 (개요/진입/핵심 포인트/흔한 실수/관련·유사 기술)
              </button>
              <MarkdownEditor
                label="설명 (마크다운 지원)"
                value={formData.description.ko}
                onChange={(val) => setFormData({ ...formData, description: { ...formData.description, ko: val } })}
                placeholder="기술에 대한 상세한 설명을 입력하세요..."
              />
            </div>

            <RelatedGroupsEditor
              groups={formData.relatedGroups}
              onChange={(relatedGroups) => setFormData({ ...formData, relatedGroups })}
            />

            <VideoUrlInput
              urls={formData.videoUrls}
              onChange={(urls) => setFormData({ ...formData, videoUrls: urls })}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={continuous}
              onChange={(e) => setContinuous(e.target.checked)}
            />
            등록 후 이어서 다음 기술 등록 (상위 기술·유형·주 역할 유지)
          </label>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
          >
            {loading ? '등록 중...' : '기술 등록하기'}
          </button>
        </form>
      </div>

      <TechniqueParentPicker
        isOpen={parentPickerOpen}
        onClose={() => setParentPickerOpen(false)}
        selectedId={formData.parentId || null}
        onSelect={(technique) => {
          // 주 역할을 직접 고르지 않았다면 상위 기술의 역할을 상속한다.
          let primaryRole = formData.primaryRole;
          if (technique?.primaryRole && (!primaryRole || roleInherited)) {
            primaryRole = technique.primaryRole;
            setRoleInherited(true);
          } else if (!technique && roleInherited) {
            primaryRole = '';
            setRoleInherited(false);
          }
          setFormData({ ...formData, parentId: technique?._id || '', primaryRole });
          setParentName(technique?.name.ko || '');
        }}
      />
    </div>
  );
}
