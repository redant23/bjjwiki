'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { DemoFields, type DemoFormValue } from '@/components/combo/DemoFields';

interface DemoFormModalProps {
  title: string;
  description?: string;
  initial: DemoFormValue;
  submitLabel: string;
  /** 오류 메시지를 돌려주면 모달에 표시하고, null이면 닫는다 */
  onSubmit: (value: DemoFormValue) => Promise<string | null>;
  onClose: () => void;
}

export function DemoFormModal({
  title,
  description,
  initial,
  submitLabel,
  onSubmit,
  onClose,
}: DemoFormModalProps) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = (value.performer.trim() || value.videoUrl.trim()) && !busy;

  async function submit() {
    setBusy(true);
    setError('');
    const message = await onSubmit(value);
    setBusy(false);
    if (message) setError(message);
    else onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-xl border border-border bg-background p-6 shadow-lg sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <DemoFields value={value} onChange={setValue} disabled={busy} />

        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground hover:bg-muted/80 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? '처리 중...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
