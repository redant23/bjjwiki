import { FIELD_LABELS, formatFieldValue } from '@/lib/technique-request-format';

export interface DiffField {
  key: string;
  before: unknown;
  after: unknown;
}

interface RequestDiffViewProps {
  type: 'create' | 'edit';
  fields: DiffField[];
  /** 'responsive'(기본): md 이상에서 변경 전/후를 좌우로 배치.
   *  'stacked': 폭이 좁은 곳(모달 등)에서 항상 위아래로 배치. */
  layout?: 'responsive' | 'stacked';
}

/** 기술 등록/수정 요청의 변경 사항을 GitHub diff 스타일(제거=빨강, 추가=초록)로 보여준다. */
export function RequestDiffView({ type, fields, layout = 'responsive' }: RequestDiffViewProps) {
  if (fields.length === 0) {
    return <p className="text-sm text-muted-foreground">변경된 내용이 없습니다.</p>;
  }

  const gridClass =
    type === 'edit' && layout === 'responsive' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1';

  return (
    <div className="space-y-4">
      {fields.map(({ key, before, after }) => (
        <div key={key} className="space-y-1.5">
          <div className="text-sm font-semibold">{FIELD_LABELS[key] || key}</div>
          <div className={`grid ${gridClass} gap-2`}>
            {type === 'edit' && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2.5">
                <div className="mb-1 text-xs font-medium text-red-700 dark:text-red-400">
                  − 변경 전
                </div>
                <pre className="whitespace-pre-wrap break-words font-sans text-sm text-red-800 dark:text-red-300">
                  {formatFieldValue(key, before)}
                </pre>
              </div>
            )}
            <div className="rounded-md border border-green-500/30 bg-green-500/10 p-2.5">
              <div className="mb-1 text-xs font-medium text-green-700 dark:text-green-400">
                {type === 'edit' ? '+ 변경 후' : '+ 입력값'}
              </div>
              <pre className="whitespace-pre-wrap break-words font-sans text-sm text-green-800 dark:text-green-300">
                {formatFieldValue(key, after)}
              </pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
