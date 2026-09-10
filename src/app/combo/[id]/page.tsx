'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Edit, Save, X, Trash2, Bookmark, Upload } from 'lucide-react';
import imageCompression from 'browser-image-compression';

interface ComboTechnique {
  _id: string;
  name: { ko: string; en?: string };
  slug: string;
  pathSlugs: string[];
}

interface ComboDetail {
  _id: string;
  name: string;
  techniques: ComboTechnique[];
  videoUrl?: string;
  photoUrl?: string;
  createdBy: { _id: string; nickname: string };
  saveCount: number;
  savedByMe?: boolean;
}

function techniqueHref(technique: ComboTechnique) {
  return `/technique/${[...(technique.pathSlugs || []), technique.slug].join('/')}`;
}

export default function ComboDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const comboId = params.id as string;

  const [combo, setCombo] = useState<ComboDetail | null>(null);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editForm, setEditForm] = useState({ name: '', videoUrl: '' });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');

  const canEdit =
    !!session && !!combo && (session.user.id === combo.createdBy._id || session.user.role === 'admin');

  useEffect(() => {
    async function fetchCombo() {
      try {
        const res = await fetch(`/api/combos/${comboId}`);
        const data = await res.json();
        if (data.success) {
          setCombo(data.data);
          setEditForm({ name: data.data.name, videoUrl: data.data.videoUrl || '' });
          setPreviewUrl(data.data.photoUrl || '');
        } else {
          setError(data.error || '콤보를 불러오지 못했습니다.');
        }
      } catch {
        setError('오류가 발생했습니다.');
      }
    }
    fetchCombo();
  }, [comboId]);

  async function handleSaveToggle() {
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    setSavingBookmark(true);
    try {
      const res = await fetch(`/api/combos/${comboId}/save`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCombo((prev) =>
          prev ? { ...prev, savedByMe: data.data.saved, saveCount: data.data.saveCount } : prev
        );
        setError('');
      } else {
        setError(data.error || '저장하지 못했습니다.');
      }
    } catch {
      setError('오류가 발생했습니다.');
    } finally {
      setSavingBookmark(false);
    }
  }

  function handleEdit() {
    if (!combo) return;
    setError('');
    setEditForm({ name: combo.name, videoUrl: combo.videoUrl || '' });
    setPreviewUrl(combo.photoUrl || '');
    setPhotoFile(null);
    setIsEditing(true);
  }

  function handleCancel() {
    setError('');
    setIsEditing(false);
    setPhotoFile(null);
    if (combo) setPreviewUrl(combo.photoUrl || '');
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
    } catch {
      setError('이미지 압축에 실패했습니다.');
    }
  }

  async function handleSave() {
    if (!combo) return;
    setSaving(true);
    setError('');
    try {
      let photoUrl: string | undefined = combo.photoUrl;
      const photoRemoved = !photoFile && !previewUrl;
      if (photoFile) {
        const formData = new FormData();
        formData.append('file', photoFile);
        formData.append('usage', 'combo_photo');
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadData.success) throw new Error('이미지 업로드에 실패했습니다.');
        photoUrl = uploadData.data.url;
      }

      const res = await fetch(`/api/combos/${comboId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          videoUrl: editForm.videoUrl.trim() || undefined,
          photoUrl: photoRemoved ? '' : (photoUrl || undefined),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCombo((prev) =>
          prev
            ? { ...prev, name: data.data.name, videoUrl: data.data.videoUrl, photoUrl: data.data.photoUrl }
            : prev
        );
        setIsEditing(false);
        setPhotoFile(null);
      } else {
        setError(data.error || '저장하지 못했습니다.');
      }
    } catch (err) {
      console.error(err);
      setError('오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    setDeleting(true);
    setShowDeleteModal(false);
    try {
      const res = await fetch(`/api/combos/${comboId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        router.push('/combo');
      } else {
        setError(data.error || '삭제하지 못했습니다.');
        setDeleting(false);
      }
    } catch {
      setError('오류가 발생했습니다.');
      setDeleting(false);
    }
  }

  if (error && !combo) {
    return (
      <div className="container max-w-2xl py-10">
        <div className="p-4 bg-destructive/10 text-destructive rounded-md">{error}</div>
      </div>
    );
  }

  if (!combo) {
    return <div className="container max-w-2xl py-10 text-muted-foreground">불러오는 중...</div>;
  }

  return (
    <div className="container max-w-2xl py-6 lg:py-10">
      <div className="flex items-start justify-between mb-6">
        {isEditing ? (
          <input
            type="text"
            value={editForm.name}
            onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
            className="text-3xl font-bold flex-1 mr-4 border-b border-input bg-transparent focus:outline-none"
          />
        ) : (
          <h1 className="text-3xl font-bold">{combo.name}</h1>
        )}

        {canEdit && !isEditing && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Edit className="h-3.5 w-3.5" />
              수정
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              삭제
            </button>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-6">by {combo.createdBy.nickname}</p>

      <div className="flex flex-wrap items-center gap-2 mb-8">
        {combo.techniques.map((technique, index) => (
          <div key={technique._id} className="flex items-center gap-2">
            <Link
              href={techniqueHref(technique)}
              className="px-3 py-1.5 rounded-md border bg-muted/30 hover:bg-muted/60 transition-colors text-sm"
            >
              {technique.name.ko}
            </Link>
            {index < combo.techniques.length - 1 && (
              <span className="text-muted-foreground">→</span>
            )}
          </div>
        ))}
      </div>

      {isEditing ? (
        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-sm font-medium mb-2">시연 영상 URL</label>
            <input
              type="text"
              value={editForm.videoUrl}
              onChange={(e) => setEditForm((prev) => ({ ...prev, videoUrl: e.target.value }))}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">시연 사진</label>
            {previewUrl ? (
              <div className="relative w-full max-w-xs">
                <img src={previewUrl} alt="미리보기" className="rounded-md border w-full" />
                <button
                  onClick={() => {
                    setPhotoFile(null);
                    setPreviewUrl('');
                  }}
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
        </div>
      ) : (
        (combo.videoUrl || combo.photoUrl) && (
          <div className="space-y-4 mb-8">
            {combo.videoUrl && (
              <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted/50">
                <iframe
                  width="100%"
                  height="100%"
                  src={combo.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/')}
                  title={combo.name}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            )}
            {combo.photoUrl && (
              <img src={combo.photoUrl} alt={combo.name} className="rounded-lg border w-full max-w-md" />
            )}
          </div>
        )
      )}

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm mb-4">
          {error}
        </div>
      )}

      {isEditing ? (
        <div className="flex gap-2 justify-end">
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
        </div>
      ) : (
        <button
          onClick={handleSaveToggle}
          disabled={savingBookmark}
          className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors disabled:opacity-50 ${
            combo.savedByMe
              ? 'border-accent text-accent bg-accent/10'
              : 'border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          }`}
        >
          <Bookmark className={`h-4 w-4 ${combo.savedByMe ? 'fill-current' : ''}`} />
          저장 {combo.saveCount}
        </button>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-lg shadow-lg max-w-md w-full mx-4 p-6 space-y-4">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">콤보 삭제</h2>
              <p className="text-muted-foreground">
                정말 <span className="font-semibold text-foreground">{combo.name}</span> 콤보를 삭제하시겠습니까?
              </p>
              <p className="text-sm text-destructive">
                이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
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
