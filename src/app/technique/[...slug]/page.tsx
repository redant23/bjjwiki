'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { ChevronRight, Edit, Save, X, Trash2, Upload } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { MarkdownEditor } from '@/components/ui/MarkdownEditor';
import { VideoUrlInput } from '@/components/ui/VideoUrlInput';

interface Technique {
  _id: string;
  slug: string;
  name: { ko: string; en?: string };
  aka: { ko: string[]; en?: string[] };
  description: { ko: string; en?: string };
  type: string;
  primaryRole: string;
  level: number;
  pathSlugs: string[];
  parentId?: { _id: string; name: { ko: string }; slug: string };
  childrenIds?: { _id: string; name: { ko: string }; slug: string; type: string; primaryRole: string }[];
  sweepsFromHere?: { _id: string; name: { ko: string }; slug: string }[];
  submissionsFromHere?: { _id: string; name: { ko: string }; slug: string }[];
  escapesFromHere?: { _id: string; name: { ko: string }; slug: string }[];
  videos: { url: string }[];
  images: { url: string; captionKo?: string; captionEn?: string }[];
  thumbnailUrl?: string;
  updatedAt: string;
}

// Permission check - currently allows everyone, but can be extended
function canEditTechnique(/* user?: User */): boolean {
  // TODO: Add authentication check when auth is implemented
  // For now, allow everyone to edit
  return true;
}

export default function TechniquePage() {
  const params = useParams();
  const router = useRouter();
  const [technique, setTechnique] = useState<Technique | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [allTechniques, setAllTechniques] = useState<Technique[]>([]);
  const [breadcrumbPath, setBreadcrumbPath] = useState<{ name: string; slug: string }[]>([]);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: { ko: '', en: '' },
    description: { ko: '', en: '' },
    aka: { ko: [] as string[], en: [] as string[] },
    type: 'both' as 'gi' | 'nogi' | 'both',
    parentId: null as string | null,
    videoUrls: [] as string[],
    thumbnailUrl: '',
  });

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  // params.slug is an array of strings, e.g. ['guard', 'x-guard']
  const slugArray = params.slug as string[];
  const currentSlug = slugArray[slugArray.length - 1];

  useEffect(() => {
    async function fetchTechnique() {
      try {
        // Fetch by slug
        const res = await fetch(`/api/techniques?slug=${currentSlug}`);
        const data = await res.json();

        if (data.success && data.data.length > 0) {
          const tech = data.data[0];

          // Fetch full details including populated fields
          const detailRes = await fetch(`/api/techniques/${tech._id}`);
          const detailData = await detailRes.json();

          if (detailData.success) {
            setTechnique(detailData.data);

            // Fetch breadcrumb path (parent techniques)
            if (detailData.data.pathSlugs && detailData.data.pathSlugs.length > 0) {
              const pathPromises = detailData.data.pathSlugs.map(async (slug: string) => {
                const pathRes = await fetch(`/api/techniques?slug=${slug}`);
                const pathData = await pathRes.json();
                if (pathData.success && pathData.data.length > 0) {
                  return { name: pathData.data[0].name.ko, slug: pathData.data[0].slug };
                }
                return { name: slug, slug };
              });
              const pathResults = await Promise.all(pathPromises);
              setBreadcrumbPath(pathResults);
            } else {
              setBreadcrumbPath([]);
            }

            // Initialize edit form
            setEditForm({
              name: {
                ko: detailData.data.name.ko,
                en: detailData.data.name.en || ''
              },
              description: {
                ko: detailData.data.description.ko,
                en: detailData.data.description.en || ''
              },
              aka: {
                ko: detailData.data.aka.ko || [],
                en: detailData.data.aka.en || [],
              },
              type: detailData.data.type || 'both',
              parentId: detailData.data.parentId?._id || null,
              videoUrls: detailData.data.videos?.map((v: any) => v.url) || [],
              thumbnailUrl: detailData.data.thumbnailUrl || '',
            });
            setPreviewUrl(detailData.data.thumbnailUrl || '');
          } else {
            setTechnique(tech); // Fallback
          }
        } else {
          setError('기술을 찾을 수 없습니다.');
        }
      } catch {
        setError('오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }

    async function fetchAllTechniques() {
      try {
        const res = await fetch('/api/techniques?status=published');
        const data = await res.json();
        if (data.success) {
          setAllTechniques(data.data);
        }
      } catch (err) {
        console.error('Failed to fetch techniques:', err);
      }
    }

    if (currentSlug) {
      fetchTechnique();
      fetchAllTechniques();
    }
  }, [currentSlug]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (!technique) return;
    // Reset form to original values
    setEditForm({
      name: {
        ko: technique.name.ko,
        en: technique.name.en || ''
      },
      description: {
        ko: technique.description.ko,
        en: technique.description.en || ''
      },
      aka: {
        ko: technique.aka.ko || [],
        en: technique.aka.en || [],
      },
      type: technique.type as 'gi' | 'nogi' | 'both',
      parentId: technique.parentId?._id || null,
      videoUrls: technique.videos?.map(v => v.url) || [],
      thumbnailUrl: technique.thumbnailUrl || '',
    });
    setThumbnailFile(null);
    setPreviewUrl(technique.thumbnailUrl || '');
    setIsEditing(false);
  };

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
      alert('이미지 압축에 실패했습니다.');
    }
  };

  const removeImage = () => {
    setThumbnailFile(null);
    setPreviewUrl('');
    setEditForm(prev => ({ ...prev, thumbnailUrl: '' }));
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!technique) return;

    setDeleting(true);
    setShowDeleteModal(false);

    try {
      const res = await fetch(`/api/techniques/${technique._id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        router.push('/');
      } else {
        alert('삭제 실패: ' + data.error);
        setDeleting(false);
      }
    } catch (err) {
      alert('삭제 중 오류가 발생했습니다.');
      console.error(err);
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
  };

  const handleSave = async () => {
    if (!technique) return;

    setSaving(true);
    try {
      let finalImageUrl = editForm.thumbnailUrl;

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

      const res = await fetch(`/api/techniques/${technique._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: {
            ko: editForm.name.ko,
            en: editForm.name.en || undefined,
          },
          description: {
            ko: editForm.description.ko,
            en: editForm.description.en || undefined,
          },
          aka: {
            ko: editForm.aka.ko,
            en: editForm.aka.en.length > 0 ? editForm.aka.en : undefined,
          },
          type: editForm.type,
          parentId: editForm.parentId || null,
          videos: editForm.videoUrls.filter(url => url.trim()).map(url => ({ url })),
          thumbnailUrl: finalImageUrl,
        }),
      });

      const data = await res.json();

      if (data.success) {
        // Refresh the technique data
        const detailRes = await fetch(`/api/techniques/${technique._id}`);
        const detailData = await detailRes.json();
        if (detailData.success) {
          setTechnique(detailData.data);
          setEditForm({
            name: {
              ko: detailData.data.name.ko,
              en: detailData.data.name.en || ''
            },
            description: {
              ko: detailData.data.description.ko,
              en: detailData.data.description.en || ''
            },
            aka: {
              ko: detailData.data.aka.ko || [],
              en: detailData.data.aka.en || [],
            },
            type: detailData.data.type || 'both',
            parentId: detailData.data.parentId?._id || null,
            videoUrls: detailData.data.videos?.map((v: any) => v.url) || [],
            thumbnailUrl: detailData.data.thumbnailUrl || '',
          });
          setPreviewUrl(detailData.data.thumbnailUrl || '');
        }
        setIsEditing(false);
      } else {
        alert('저장 실패: ' + data.error);
      }
    } catch (err) {
      alert('저장 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-8 w-1/3 bg-muted animate-pulse rounded" />
        <div className="h-64 w-full bg-muted animate-pulse rounded" />
        <div className="h-32 w-full bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (error || !technique) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-destructive">오류</h2>
        <p className="text-muted-foreground">{error || '기술을 찾을 수 없습니다.'}</p>
        <Link href="/" className="mt-4 inline-block underline">
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  const translateRole = (role: string) => {
    const map: Record<string, string> = {
      position: '포지션',
      guard: '가드',
      submission: '서브미션',
      sweep: '스윕',
      escape: '이스케이프',
      guard_pass: '가드 패스',
      drill: '드릴',
      transition: '트랜지션',
    };
    return map[role] || role;
  };

  const translateType = (type: string) => {
    const map: Record<string, string> = {
      gi: '기 (도복)',
      nogi: '노기',
      both: '기/노기 공용',
    };
    return map[type] || type;
  };

  return (
    <div className="w-full">
      {/* Breadcrumbs */}
      <nav className="mb-6 flex items-center text-sm text-muted-foreground overflow-x-auto whitespace-nowrap" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-foreground transition-colors">홈</Link>
        <ChevronRight className="mx-2 h-4 w-4 flex-shrink-0" />
        {breadcrumbPath.map((item, index) => (
          <div key={item.slug} className="flex items-center">
            <Link
              href={`/technique/${breadcrumbPath.slice(0, index + 1).map(p => p.slug).join('/')}`}
              className="hover:text-foreground transition-colors"
            >
              {item.name}
            </Link>
            <ChevronRight className="mx-2 h-4 w-4 flex-shrink-0" />
          </div>
        ))}
        <span className="font-medium text-foreground">{technique.name.ko}</span>
      </nav>

      <article className="space-y-8">
        {/* Header Area */}
        <header className="relative mb-8">
          {/* Action Buttons */}
          <div className="absolute top-0 right-0 flex gap-2 z-10">
            {canEditTechnique() && !isEditing && (
              <>
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Edit className="h-4 w-4" />
                  수정
                </button>
                <button
                  onClick={handleDeleteClick}
                  disabled={deleting}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  삭제
                </button>
              </>
            )}

            {isEditing && (
              <>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? '저장 중...' : '저장'}
                </button>
              </>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-6 pt-12">
              {/* Thumbnail Edit */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                <h3 className="text-lg font-semibold">썸네일 이미지</h3>
                <div className="flex items-center gap-4">
                  {previewUrl ? (
                    <div className="relative w-40 aspect-square rounded-md overflow-hidden border border-border">
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
                    <div className="flex items-center justify-center w-40 aspect-square rounded-md border border-dashed border-input bg-muted/50">
                      <span className="text-xs text-muted-foreground">이미지 없음</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <label
                      htmlFor="thumbnail-upload-edit"
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 cursor-pointer"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      이미지 업로드
                    </label>
                    <input
                      id="thumbnail-upload-edit"
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

              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">기술 이름 (한국어)</label>
                  <input
                    type="text"
                    value={editForm.name.ko}
                    onChange={(e) => setEditForm({ ...editForm, name: { ...editForm.name, ko: e.target.value } })}
                    className="w-full px-3 py-2 text-xl font-bold border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">기술 이름 (영어)</label>
                  <input
                    type="text"
                    value={editForm.name.en}
                    onChange={(e) => setEditForm({ ...editForm, name: { ...editForm.name, en: e.target.value } })}
                    className="w-full px-3 py-2 text-lg border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              {/* Type Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">유형</label>
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value as 'gi' | 'nogi' | 'both' })}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="both">기/노기 공용</option>
                    <option value="gi">기 (도복)</option>
                    <option value="nogi">노기</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">상위 기술 (Parent)</label>
                  <select
                    value={editForm.parentId || ''}
                    onChange={(e) => setEditForm({ ...editForm, parentId: e.target.value || null })}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">없음 (최상위)</option>
                    {allTechniques
                      .filter(t => t._id !== technique?._id) // Prevent selecting self
                      .sort((a, b) => a.name.ko.localeCompare(b.name.ko))
                      .map((tech) => (
                        <option key={tech._id} value={tech._id}>
                          {tech.name.ko} {tech.name.en ? `(${tech.name.en})` : ''} - Level {tech.level}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row gap-6 items-start pt-12 md:pt-0">
              {/* Thumbnail - Left side */}
              {technique.thumbnailUrl && (
                <div className="w-full md:w-[200px] flex-shrink-0 aspect-square rounded-lg overflow-hidden border border-border bg-muted/50">
                  <img
                    src={technique.thumbnailUrl}
                    alt={technique.name.ko}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Title & Info - Right side */}
              <div className="flex-1 w-full">
                <h1 className="text-4xl font-bold tracking-tight lg:text-5xl mb-2">
                  {technique.name.ko}
                </h1>
                {technique.name.en && (
                  <p className="text-xl text-muted-foreground mb-4">{technique.name.en}</p>
                )}

                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary capitalize">
                    {translateRole(technique.primaryRole)}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground capitalize">
                    {translateType(technique.type)}
                  </span>
                  {technique.level > 1 && (
                    <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
                      Level {technique.level}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </header>

        {/* Media */}
        {isEditing ? (
          <VideoUrlInput
            urls={editForm.videoUrls}
            onChange={(urls) => setEditForm({ ...editForm, videoUrls: urls })}
          />
        ) : (
          technique.videos && technique.videos.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {technique.videos.map((video, index) => (
                <div key={index} className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted/50">
                  <iframe
                    width="100%"
                    height="100%"
                    src={video.url.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/')}
                    title={`${technique.name.ko} - Video ${index + 1}`}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
              ))}
            </div>
          )
        )}

        {/* Description */}
        <section className="prose prose-zinc dark:prose-invert max-w-none prose-headings:font-semibold prose-p:text-foreground/90 prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:text-foreground">
          {isEditing ? (
            <div className="space-y-4">
              <MarkdownEditor
                label="설명 (한국어)"
                value={editForm.description.ko}
                onChange={(val) => setEditForm({ ...editForm, description: { ...editForm.description, ko: val } })}
                placeholder="기술에 대한 상세한 설명을 입력하세요..."
              />
              <div>
                <label className="block text-sm font-medium mb-2">설명 (영어)</label>
                <textarea
                  value={editForm.description.en}
                  onChange={(e) => setEditForm({ ...editForm, description: { ...editForm.description, en: e.target.value } })}
                  rows={5}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
                  placeholder="Markdown supported (optional)"
                />
              </div>
            </div>
          ) : (
            <ReactMarkdown>{technique.description.ko}</ReactMarkdown>
          )}
        </section>

        {/* Children / Variations */}
        {technique.childrenIds && technique.childrenIds.length > 0 && (
          <section className="pt-6 border-t border-border">
            <h2 className="text-2xl font-semibold mb-4">하위 기술 및 변형</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {technique.childrenIds.map((child) => (
                <Link
                  key={child._id}
                  href={`/technique/${[...technique.pathSlugs, technique.slug, child.slug].join('/')}`}
                  className="block p-4 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/50 transition-all"
                >
                  <div className="font-semibold text-foreground mb-1">{child.name.ko}</div>
                  <div className="text-sm text-muted-foreground capitalize">
                    {translateRole(child.primaryRole)} • {translateType(child.type)}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <footer className="pt-6 text-sm text-muted-foreground border-t border-border">
          최종 수정: {new Date(technique.updatedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
        </footer>
      </article>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-lg shadow-lg max-w-md w-full mx-4 p-6 space-y-4">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">기술 삭제</h2>
              <p className="text-muted-foreground">
                정말 <span className="font-semibold text-foreground">{technique?.name.ko}</span> 기술을 삭제하시겠습니까?
              </p>
              <p className="text-sm text-destructive">
                이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleDeleteCancel}
                disabled={deleting}
                className="px-4 py-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
