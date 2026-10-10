export const REQUEST_TYPE_LABEL: Record<string, string> = {
  create_combo: '콤보 등록',
  add_demo: '시연 추가',
  edit_demo: '시연 수정',
  delete_demo: '시연 삭제',
};

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  pending: '대기중',
  approved: '승인됨',
  rejected: '반려됨',
  cancelled: '취소됨',
};

export const REQUEST_STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-900',
  approved: 'bg-green-100 text-green-900',
  rejected: 'bg-red-100 text-red-900',
  cancelled: 'bg-zinc-200 text-zinc-800',
};

export interface ComboRequestItem {
  _id: string;
  type: 'create_combo' | 'add_demo' | 'edit_demo' | 'delete_demo';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  payload: {
    demo: { performer?: string; videoUrl?: string; gearType?: string } | null;
    demoId: string | null;
    before: { performer?: string; videoUrl?: string; gearType?: string } | null;
  };
  combo: {
    _id: string;
    number: number | null;
    status: string;
    techniques: Array<{ _id: string; name: { ko: string } }>;
    demos: Array<{ _id: string; performer?: string; videoUrl?: string; gearType?: string }>;
  } | null;
  requestedBy: { _id: string; nickname: string } | null;
  reviewNote: string | null;
  resultNumber: number | null;
  resubmitted: boolean;
  createdAt: string;
}

export function chainText(request: ComboRequestItem): string {
  return request.combo?.techniques.map((t) => t.name.ko).join(' → ') || '(삭제된 콤보)';
}

export function demoText(demo?: { performer?: string; videoUrl?: string; gearType?: string } | null): string {
  if (!demo) return '-';
  const gear = demo.gearType === 'gi' ? '기' : demo.gearType === 'nogi' ? '노기' : '복장 모름';
  return [demo.performer || '시전자 없음', demo.videoUrl ? `영상 있음 · ${gear}` : '영상 없음'].join(' · ');
}
