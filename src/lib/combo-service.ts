// 콤보 v2 서버 로직: 공개 범위, 번호 발급, 등록/승인/반려/취소, 시연 반영.
// 권한·중복·공개 범위 검증은 전부 여기(서버)에서 한다. 라우트는 얇게 유지한다.
import mongoose from 'mongoose';
import type { Session } from 'next-auth';
import dbConnect from '@/lib/db';
import Combo from '@/models/Combo';
import ComboRequest, { type IComboRequest, type ComboRequestType } from '@/models/ComboRequest';
import Counter from '@/models/Counter';
import Notification, { type NotificationType } from '@/models/Notification';
import Technique from '@/models/Technique';
import User from '@/models/User';
import {
  buildChainKey,
  MIN_COMBO_TECHNIQUES,
  parseComboNumberParam,
  isObjectIdString,
  validateDemoInput,
  type DemoInput,
  type CleanDemo,
} from '@/lib/combo-chain';

export class ServiceError extends Error {
  status: number;
  extra?: Record<string, unknown>;
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export interface Viewer {
  id: string;
  isAdmin: boolean;
}

export function viewerFromSession(session: Session | null): Viewer | null {
  if (!session?.user?.id) return null;
  return { id: session.user.id, isAdmin: session.user.role === 'admin' };
}

/** 공개된 콤보. 상태 필드가 없던 레거시 문서도 공개로 본다(마이그레이션 전 안전망). */
export const PUBLISHED_FILTER = { status: { $nin: ['pending', 'rejected'] } } as const;

const TECHNIQUE_POPULATE = 'name slug pathSlugs';

/** 목록에서 viewer가 볼 수 있는 콤보: 공개 + (본인 pending | 관리자는 모든 pending). */
export function listVisibleFilter(viewer: Viewer | null): Record<string, unknown> {
  if (!viewer) return { ...PUBLISHED_FILTER };
  if (viewer.isAdmin) return { status: { $ne: 'rejected' } };
  return {
    $or: [
      { ...PUBLISHED_FILTER },
      { status: 'pending', createdBy: new mongoose.Types.ObjectId(viewer.id) },
    ],
  };
}

export function isComboPublished(combo: { status?: string }): boolean {
  return combo.status !== 'pending' && combo.status !== 'rejected';
}

/** 상세 접근 권한. 공개된 콤보는 누구나, pending/rejected는 작성자와 관리자만. */
export function canViewCombo(
  combo: { status?: string; createdBy: unknown },
  viewer: Viewer | null
): boolean {
  if (isComboPublished(combo)) return true;
  if (!viewer) return false;
  return viewer.isAdmin || String(combo.createdBy) === viewer.id;
}

/** 주소 조각(번호 또는 ObjectId)으로 콤보를 찾는다. 없으면 null. */
export async function findComboByParam(param: string) {
  const number = parseComboNumberParam(param);
  if (number !== null) return Combo.findOne({ number });
  if (isObjectIdString(param)) return Combo.findById(param);
  return null;
}

export async function nextComboNumber(): Promise<number> {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'combo' },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return counter.seq;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;
}

// ---------- 직렬화 ----------

export interface TechniqueRef {
  _id: string;
  name: { ko: string; en?: string };
  slug: string;
  pathSlugs: string[];
}

export interface DemoView {
  _id: string;
  performer?: string;
  videoUrl?: string;
  gearType: 'gi' | 'nogi' | 'unknown';
  createdBy?: { _id: string; nickname: string } | null;
  createdAt?: string;
  pending?: boolean;
}

export interface ComboView {
  _id: string;
  number: number | null;
  status: 'pending' | 'published' | 'rejected';
  techniques: TechniqueRef[];
  demos: DemoView[];
  createdBy: { _id: string; nickname: string } | null;
  saveCount: number;
  savedByMe: boolean;
  isMine: boolean;
  publishedAt?: string;
  createdAt?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function serializeCombo(doc: any, viewer: Viewer | null, savedSet: Set<string>): ComboView {
  const id = String(doc._id);
  const status = doc.status === 'pending' || doc.status === 'rejected' ? doc.status : 'published';
  const createdBy = doc.createdBy && typeof doc.createdBy === 'object' && doc.createdBy.nickname
    ? { _id: String(doc.createdBy._id), nickname: doc.createdBy.nickname as string }
    : null;
  const createdById = doc.createdBy?._id ? String(doc.createdBy._id) : String(doc.createdBy ?? '');
  return {
    _id: id,
    number: typeof doc.number === 'number' ? doc.number : null,
    status,
    techniques: (doc.techniques ?? [])
      .filter((t: any) => t && typeof t === 'object' && t.name)
      .map((t: any) => ({
        _id: String(t._id),
        name: t.name,
        slug: t.slug,
        pathSlugs: t.pathSlugs ?? [],
      })),
    demos: (doc.demos ?? []).map((d: any) => ({
      _id: String(d._id),
      performer: d.performer || undefined,
      videoUrl: d.videoUrl || undefined,
      gearType: d.gearType === 'gi' || d.gearType === 'nogi' ? d.gearType : 'unknown',
      createdBy:
        d.createdBy && typeof d.createdBy === 'object' && d.createdBy.nickname
          ? { _id: String(d.createdBy._id), nickname: d.createdBy.nickname }
          : null,
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : undefined,
    })),
    createdBy,
    saveCount: doc.saveCount ?? 0,
    savedByMe: savedSet.has(id),
    isMine: !!viewer && createdById === viewer.id,
    publishedAt: doc.publishedAt ? new Date(doc.publishedAt).toISOString() : undefined,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
  };
}

export async function loadSavedSet(viewer: Viewer | null): Promise<Set<string>> {
  if (!viewer) return new Set();
  const user: any = await User.findById(viewer.id).select('savedCombos').lean();
  return new Set((user?.savedCombos ?? []).map((id: any) => String(id)));
}

export const COMBO_POPULATE = [
  { path: 'techniques', select: TECHNIQUE_POPULATE },
  { path: 'createdBy', select: 'nickname' },
  { path: 'demos.createdBy', select: 'nickname' },
] as const;

// ---------- 알림 ----------

async function notify(
  userIds: Array<string | mongoose.Types.ObjectId>,
  data: { type: NotificationType; message: string; link: string; relatedRequestId?: unknown }
) {
  if (userIds.length === 0) return;
  try {
    await Notification.insertMany(
      userIds.map((user) => ({ user, isRead: false, ...data }))
    );
  } catch (error) {
    // 알림 실패가 요청 처리를 되돌리지는 않는다.
    console.error('Failed to create combo notification:', error);
  }
}

async function adminIds() {
  const admins = await User.find({ role: 'admin' }).select('_id').lean();
  return admins.map((a: any) => a._id as mongoose.Types.ObjectId);
}

export async function chainSummary(techniqueIds: any[]): Promise<string> {
  const docs: any[] = await Technique.find({ _id: { $in: techniqueIds } }).select('name').lean();
  const byId = new Map(docs.map((d) => [String(d._id), d.name?.ko as string]));
  return techniqueIds.map((id) => byId.get(String(id)) ?? '?').join(' → ');
}

const REQUEST_LABEL: Record<ComboRequestType, string> = {
  create_combo: '콤보 등록',
  add_demo: '시연 추가',
  edit_demo: '시연 수정',
  delete_demo: '시연 삭제',
};
export { REQUEST_LABEL };

// ---------- 기술 순서 검증 ----------

export async function parseTechniqueIds(input: unknown): Promise<mongoose.Types.ObjectId[]> {
  const ids: string[] = Array.isArray(input) ? input.map(String) : [];
  if (ids.length < MIN_COMBO_TECHNIQUES || !ids.every((id) => mongoose.Types.ObjectId.isValid(id))) {
    throw new ServiceError(400, '기술은 2개 이상, 유효한 ID여야 합니다.');
  }
  const unique = [...new Set(ids)];
  const count = await Technique.countDocuments({ _id: { $in: unique }, status: 'published' });
  if (count !== unique.length) {
    throw new ServiceError(400, '존재하지 않는 기술이 포함되어 있습니다.');
  }
  return ids.map((id) => new mongoose.Types.ObjectId(id));
}

/** 같은 기술 순서의 활성(pending/published) 콤보. exceptId는 자기 자신 제외. */
export async function findActiveByChainKey(chainKey: string, exceptId?: unknown) {
  const query: Record<string, unknown> = {
    chainKey,
    status: { $in: ['pending', 'published'] },
  };
  if (exceptId) query._id = { $ne: exceptId };
  return Combo.findOne(query).select('number status createdBy').lean() as Promise<any>;
}

/** 중복 시 클라이언트에 줄 정보. pending 콤보의 정보는 요청자 본인(과 관리자)에게만 준다. */
export function duplicateInfo(existing: any, viewer: Viewer | null) {
  const published = isComboPublished(existing);
  if (published) {
    return { status: 'published' as const, number: existing.number ?? null, _id: String(existing._id) };
  }
  const mine = !!viewer && (viewer.isAdmin || String(existing.createdBy) === viewer.id);
  return mine
    ? { status: 'pending' as const, mine: true, _id: String(existing._id) }
    : { status: 'pending' as const, mine: false };
}

export function duplicateMessage(info: ReturnType<typeof duplicateInfo>): string {
  return info.status === 'published'
    ? '이미 등록된 콤보예요. 시연 영상과 시전자를 추가 요청할 수 있어요.'
    : '같은 순서가 이미 승인 대기 중이에요.';
}

// ---------- 콤보 등록 ----------

function buildDemoDoc(demo: CleanDemo, userId: string) {
  return {
    _id: new mongoose.Types.ObjectId(),
    performer: demo.performer,
    videoUrl: demo.videoUrl,
    gearType: demo.gearType,
    videoKey: demo.videoKey,
    createdBy: new mongoose.Types.ObjectId(userId),
    createdAt: new Date(),
  };
}

/** 첫 시연 입력: 비어 있으면 null, 값이 있으면 검증한다. */
function parseOptionalDemo(input: unknown): CleanDemo | null {
  if (!input || typeof input !== 'object') return null;
  const demo = input as DemoInput;
  const hasContent =
    (typeof demo.performer === 'string' && demo.performer.trim()) ||
    (typeof demo.videoUrl === 'string' && demo.videoUrl.trim());
  if (!hasContent) return null;
  const result = validateDemoInput(demo);
  if (!result.ok) throw new ServiceError(400, result.error);
  return result.demo;
}

async function publishPendingCombo(comboId: any): Promise<number> {
  const number = await nextComboNumber();
  const published = await Combo.findOneAndUpdate(
    { _id: comboId, status: 'pending' },
    { $set: { status: 'published', number, publishedAt: new Date() } },
    { new: true }
  );
  if (!published) throw new ServiceError(409, '콤보 상태가 바뀌어 공개하지 못했습니다.');
  return number;
}

export async function submitCombo(
  viewer: Viewer,
  body: { techniques?: unknown; demo?: unknown }
): Promise<{ combo: any; request: IComboRequest | null; published: boolean }> {
  await dbConnect();
  const techniqueIds = await parseTechniqueIds(body.techniques);
  const demo = parseOptionalDemo(body.demo);
  const chainKey = buildChainKey(techniqueIds.map(String));

  const existing = await findActiveByChainKey(chainKey);
  if (existing) {
    const info = duplicateInfo(existing, viewer);
    throw new ServiceError(409, duplicateMessage(info), { existing: info });
  }

  let combo;
  try {
    combo = await Combo.create({
      techniques: techniqueIds,
      chainKey,
      status: 'pending',
      demos: demo ? [buildDemoDoc(demo, viewer.id)] : [],
      createdBy: viewer.id,
      saveCount: 0,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const raced = await findActiveByChainKey(chainKey);
      const info = raced ? duplicateInfo(raced, viewer) : null;
      throw new ServiceError(409, info ? duplicateMessage(info) : '이미 등록된 콤보예요.', info ? { existing: info } : undefined);
    }
    throw error;
  }

  if (viewer.isAdmin) {
    const number = await publishPendingCombo(combo._id);
    combo.status = 'published';
    combo.number = number;
    return { combo, request: null, published: true };
  }

  const request = await ComboRequest.create({
    combo: combo._id,
    type: 'create_combo',
    payload: demo ? { demo } : {},
    requestedBy: viewer.id,
    status: 'pending',
  });
  await notifySubmitted(viewer, request, techniqueIds, `/combo/pending/${combo._id}`);
  return { combo, request, published: false };
}

async function notifySubmitted(
  viewer: Viewer,
  request: IComboRequest,
  techniqueIds: any[],
  link: string
) {
  const summary = await chainSummary(techniqueIds);
  await notify([viewer.id], {
    type: 'combo_request_received',
    message:
      request.type === 'create_combo'
        ? '콤보 등록 요청이 접수되었어요. 관리자 승인 후 전체 공개됩니다.'
        : `${REQUEST_LABEL[request.type]} 요청이 접수되었어요. 관리자 승인 후 반영됩니다.`,
    link,
    relatedRequestId: request._id,
  });
  const admins = (await adminIds()).filter((id) => String(id) !== viewer.id);
  await notify(admins, {
    type: 'combo_new_request',
    message: `새 요청 · ${REQUEST_LABEL[request.type]} · ${summary}`,
    link: '/admin/combo-requests',
    relatedRequestId: request._id,
  });
}

// ---------- 시연 요청 / 반영 ----------

interface DemoChange {
  type: Exclude<ComboRequestType, 'create_combo'>;
  demoId?: string;
  demo?: unknown;
}

async function applyDemoChange(
  comboId: any,
  change: { type: DemoChange['type']; demoId?: any; demo?: CleanDemo },
  userId: string
) {
  if (change.type === 'add_demo') {
    const doc = buildDemoDoc(change.demo!, userId);
    const filter: Record<string, unknown> = { _id: comboId };
    if (doc.videoKey) filter['demos.videoKey'] = { $ne: doc.videoKey };
    const result = await Combo.updateOne(filter, { $push: { demos: doc } });
    if (result.matchedCount === 0) throw new ServiceError(409, '이미 같은 영상(시작 시간 포함)의 시연이 있어요.');
    return;
  }

  if (change.type === 'edit_demo') {
    const demo = change.demo!;
    const filter: Record<string, unknown> = { _id: comboId, 'demos._id': change.demoId };
    if (demo.videoKey) {
      filter.demos = { $not: { $elemMatch: { videoKey: demo.videoKey, _id: { $ne: change.demoId } } } };
    }
    const $set: Record<string, unknown> = { 'demos.$.gearType': demo.gearType };
    const $unset: Record<string, 1> = {};
    for (const [field, value] of [
      ['performer', demo.performer],
      ['videoUrl', demo.videoUrl],
      ['videoKey', demo.videoKey],
    ] as const) {
      if (value) $set[`demos.$.${field}`] = value;
      else $unset[`demos.$.${field}`] = 1;
    }
    const update: Record<string, unknown> = { $set };
    if (Object.keys($unset).length) update.$unset = $unset;
    const result = await Combo.updateOne(filter, update);
    if (result.matchedCount === 0) {
      throw new ServiceError(409, '시연을 찾을 수 없거나 같은 영상(시작 시간 포함)의 시연이 이미 있어요.');
    }
    return;
  }

  const result = await Combo.updateOne(
    { _id: comboId, 'demos._id': change.demoId },
    { $pull: { demos: { _id: change.demoId } } }
  );
  if (result.matchedCount === 0) throw new ServiceError(404, '시연을 찾을 수 없습니다.');
}

function demoSnapshot(demo: any) {
  return { performer: demo.performer, videoUrl: demo.videoUrl, gearType: demo.gearType };
}

function requestDedupeKey(comboId: unknown, type: DemoChange['type'], demoId: unknown, videoKey?: string) {
  if (type === 'add_demo') return videoKey ? `${comboId}|add|${videoKey}` : undefined;
  return `${comboId}|${demoId}|${type}`;
}

/** 시연 추가/수정/삭제. 관리자는 즉시 반영하고, 일반 사용자는 요청으로 저장한다. */
export async function submitDemoChange(
  viewer: Viewer,
  comboParam: string,
  change: DemoChange
): Promise<{ applied: boolean; request: IComboRequest | null; combo: any }> {
  await dbConnect();
  const combo: any = await findComboByParam(comboParam);
  if (!combo || !canViewCombo(combo, viewer) || !isComboPublished(combo)) {
    throw new ServiceError(404, 'Combo not found');
  }

  let clean: CleanDemo | undefined;
  let target: any;
  if (change.type !== 'delete_demo') {
    const validated = validateDemoInput((change.demo ?? {}) as DemoInput);
    if (!validated.ok) throw new ServiceError(400, validated.error);
    clean = validated.demo;
  }
  if (change.type !== 'add_demo') {
    target = combo.demos.find((d: any) => String(d._id) === String(change.demoId));
    if (!target) throw new ServiceError(404, '시연을 찾을 수 없습니다.');
  }

  // 같은 영상(링크+시작 시간)은 콤보 안에서 한 번만. edit는 자기 자신 제외.
  if (clean?.videoKey) {
    const clash = combo.demos.find(
      (d: any) => d.videoKey === clean!.videoKey && String(d._id) !== String(change.demoId ?? '')
    );
    if (clash) throw new ServiceError(409, '이미 같은 영상(시작 시간 포함)의 시연이 있어요.');
  }

  if (viewer.isAdmin) {
    await applyDemoChange(combo._id, { type: change.type, demoId: change.demoId, demo: clean }, viewer.id);
    return { applied: true, request: null, combo };
  }

  // 대기 중인 다른 요청과 같은 영상이면 중복 요청으로 거부
  if (clean?.videoKey) {
    const dupPending = await ComboRequest.exists({
      combo: combo._id,
      status: 'pending',
      type: { $in: ['add_demo', 'edit_demo'] },
      'payload.demo.videoKey': clean.videoKey,
    });
    if (dupPending) throw new ServiceError(409, '같은 영상 링크로 대기 중인 시연 요청이 이미 있어요.');
  }

  try {
    const request = await ComboRequest.create({
      combo: combo._id,
      type: change.type,
      payload: {
        ...(clean ? { demo: clean } : {}),
        ...(target ? { demoId: target._id, before: demoSnapshot(target) } : {}),
      },
      requestedBy: viewer.id,
      status: 'pending',
      dedupeKey: requestDedupeKey(combo._id, change.type, change.demoId, clean?.videoKey),
    });
    await notifySubmitted(viewer, request, combo.techniques, comboLink(combo));
    return { applied: false, request, combo };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ServiceError(
        409,
        change.type === 'add_demo'
          ? '같은 영상 링크로 대기 중인 시연 요청이 이미 있어요.'
          : '이 시연에 대해 대기 중인 요청이 이미 있어요.'
      );
    }
    throw error;
  }
}

export function comboLink(combo: { number?: number | null; _id: unknown; status?: string }): string {
  return typeof combo.number === 'number' && isComboPublished(combo)
    ? `/combo/${combo.number}`
    : `/combo/pending/${combo._id}`;
}

// ---------- 승인 / 반려 / 취소 / 재요청 ----------

export interface ApproveEdits {
  techniques?: unknown;
  demo?: unknown;
}

export async function approveRequest(
  requestId: string,
  adminId: string,
  edits: ApproveEdits = {}
): Promise<{ request: IComboRequest; number: number | null }> {
  await dbConnect();
  // 먼저 대기→승인으로 선점한다. 더블클릭/동시 승인에서 번호가 두 번 소모되지 않는다.
  const claimed = await ComboRequest.findOneAndUpdate(
    { _id: requestId, status: 'pending' },
    { $set: { status: 'approved', reviewedBy: adminId, reviewedAt: new Date() } },
    { new: true }
  );
  if (!claimed) {
    const exists = await ComboRequest.exists({ _id: requestId });
    throw new ServiceError(exists ? 409 : 404, exists ? '이미 처리된 요청입니다.' : 'Request not found');
  }

  try {
    const combo: any = await Combo.findById(claimed.combo);
    if (!combo) throw new ServiceError(404, '대상 콤보가 없습니다.');

    let number: number | null = typeof combo.number === 'number' ? combo.number : null;

    if (claimed.type === 'create_combo') {
      if (combo.status !== 'pending') throw new ServiceError(409, '대기 중인 콤보가 아닙니다.');
      if (edits.techniques !== undefined) {
        const techniqueIds = await parseTechniqueIds(edits.techniques);
        const chainKey = buildChainKey(techniqueIds.map(String));
        const clash = await findActiveByChainKey(chainKey, combo._id);
        if (clash) throw new ServiceError(409, '같은 기술 순서의 콤보가 이미 있어요.');
        await Combo.updateOne({ _id: combo._id }, { $set: { techniques: techniqueIds, chainKey } });
      }
      if (edits.demo !== undefined) {
        const clean = parseOptionalDemo(edits.demo);
        const first = combo.demos?.[0];
        if (clean && first) {
          await applyDemoChange(combo._id, { type: 'edit_demo', demoId: first._id, demo: clean }, adminId);
        } else if (clean) {
          await applyDemoChange(combo._id, { type: 'add_demo', demo: clean }, String(claimed.requestedBy));
        } else if (first) {
          await applyDemoChange(combo._id, { type: 'delete_demo', demoId: first._id }, adminId);
        }
      }
      number = await publishPendingCombo(combo._id);
      claimed.resultNumber = number;
      await claimed.save();
    } else {
      const payload: any = claimed.payload ?? {};
      let clean: CleanDemo | undefined;
      if (claimed.type !== 'delete_demo') {
        const merged = edits.demo !== undefined ? edits.demo : payload.demo;
        const validated = validateDemoInput((merged ?? {}) as DemoInput);
        if (!validated.ok) throw new ServiceError(400, validated.error);
        clean = validated.demo;
      }
      await applyDemoChange(
        combo._id,
        { type: claimed.type, demoId: payload.demoId, demo: clean },
        String(claimed.requestedBy)
      );
    }

    await notify([claimed.requestedBy as any], {
      type: 'combo_approved',
      message:
        claimed.type === 'create_combo'
          ? `승인되어 #${number}번 콤보로 공개되었어요`
          : `${REQUEST_LABEL[claimed.type]} 요청이 승인되었어요`,
      link: number ? `/combo/${number}` : '/combo',
      relatedRequestId: claimed._id,
    });
    return { request: claimed, number };
  } catch (error) {
    // 반영에 실패하면 선점을 풀어 다시 처리할 수 있게 한다.
    await ComboRequest.updateOne(
      { _id: claimed._id },
      { $set: { status: 'pending' }, $unset: { reviewedBy: 1, reviewedAt: 1, resultNumber: 1 } }
    );
    throw error;
  }
}

export async function rejectRequest(requestId: string, adminId: string, note: unknown) {
  await dbConnect();
  const reviewNote = typeof note === 'string' ? note.trim().slice(0, 500) : '';
  if (!reviewNote) throw new ServiceError(400, '반려 사유를 입력해주세요.');

  const rejected = await ComboRequest.findOneAndUpdate(
    { _id: requestId, status: 'pending' },
    { $set: { status: 'rejected', reviewNote, reviewedBy: adminId, reviewedAt: new Date() } },
    { new: true }
  );
  if (!rejected) {
    const exists = await ComboRequest.exists({ _id: requestId });
    throw new ServiceError(exists ? 409 : 404, exists ? '이미 처리된 요청입니다.' : 'Request not found');
  }
  if (rejected.type === 'create_combo') {
    // 상태를 rejected로 돌려 기술 순서(chainKey)를 풀어준다.
    await Combo.updateOne({ _id: rejected.combo, status: 'pending' }, { $set: { status: 'rejected' } });
  }
  await notify([rejected.requestedBy as any], {
    type: 'combo_rejected',
    message: `${REQUEST_LABEL[rejected.type]} 요청이 반려되었어요: ${reviewNote}`,
    link: `/profile/combo-requests#${rejected._id}`,
    relatedRequestId: rejected._id,
  });
  return rejected;
}

export async function cancelRequest(requestId: string, viewer: Viewer) {
  await dbConnect();
  const request = await ComboRequest.findById(requestId);
  if (!request || (String(request.requestedBy) !== viewer.id && !viewer.isAdmin)) {
    throw new ServiceError(404, 'Request not found');
  }
  const cancelled = await ComboRequest.findOneAndUpdate(
    { _id: requestId, status: 'pending' },
    { $set: { status: 'cancelled' }, $unset: { dedupeKey: 1 } },
    { new: true }
  );
  if (!cancelled) throw new ServiceError(409, '대기 중인 요청만 취소할 수 있어요.');
  if (cancelled.type === 'create_combo') {
    // 취소된 콤보는 번호를 소모하지 않는다. 문서를 지워 기술 순서도 풀어준다.
    await Combo.deleteOne({ _id: cancelled.combo, status: 'pending' });
  }
  return cancelled;
}

/** 반려된 요청을 수정해 다시 낸다. create_combo는 기술 순서·첫 시연을, 시연 요청은 시연 값을 바꾼다. */
export async function resubmitRequest(
  requestId: string,
  viewer: Viewer,
  body: { techniques?: unknown; demo?: unknown }
) {
  await dbConnect();
  const old = await ComboRequest.findById(requestId);
  if (!old || String(old.requestedBy) !== viewer.id) throw new ServiceError(404, 'Request not found');
  if (old.status !== 'rejected' || old.resubmittedAs) {
    throw new ServiceError(409, '반려된 요청만 다시 요청할 수 있어요.');
  }

  if (old.type !== 'create_combo') {
    const result = await submitDemoChange(viewer, String(old.combo), {
      type: old.type,
      demoId: (old.payload as any)?.demoId ? String((old.payload as any).demoId) : undefined,
      demo: body.demo ?? (old.payload as any)?.demo,
    });
    if (result.request) await ComboRequest.updateOne({ _id: old._id }, { $set: { resubmittedAs: result.request._id } });
    return result.request;
  }

  const combo: any = await Combo.findById(old.combo);
  if (!combo || combo.status !== 'rejected') throw new ServiceError(404, '다시 요청할 콤보가 없습니다.');

  const techniqueIds = await parseTechniqueIds(body.techniques ?? combo.techniques.map(String));
  const demo = body.demo !== undefined ? parseOptionalDemo(body.demo) : null;
  const chainKey = buildChainKey(techniqueIds.map(String));
  const clash = await findActiveByChainKey(chainKey, combo._id);
  if (clash) {
    const info = duplicateInfo(clash, viewer);
    throw new ServiceError(409, duplicateMessage(info), { existing: info });
  }

  // 이 반려 요청을 한 번만 다시 낼 수 있게 먼저 선점한다.
  const marker = new mongoose.Types.ObjectId();
  const claimed = await ComboRequest.findOneAndUpdate(
    { _id: old._id, status: 'rejected', resubmittedAs: { $exists: false } },
    { $set: { resubmittedAs: marker } },
    { new: true }
  );
  if (!claimed) throw new ServiceError(409, '이미 다시 요청한 건입니다.');

  try {
    await Combo.updateOne(
      { _id: combo._id, status: 'rejected' },
      {
        $set: {
          techniques: techniqueIds,
          chainKey,
          status: 'pending',
          demos: demo ? [buildDemoDoc(demo, viewer.id)] : combo.demos,
        },
      }
    );
  } catch (error) {
    await ComboRequest.updateOne({ _id: old._id }, { $unset: { resubmittedAs: 1 } });
    if (isDuplicateKeyError(error)) throw new ServiceError(409, '같은 기술 순서가 이미 있어요.');
    throw error;
  }

  const request = await ComboRequest.create({
    combo: combo._id,
    type: 'create_combo',
    payload: demo ? { demo } : (old.payload ?? {}),
    requestedBy: viewer.id,
    status: 'pending',
  });
  await ComboRequest.updateOne({ _id: old._id }, { $set: { resubmittedAs: request._id } });
  await notifySubmitted(viewer, request, techniqueIds, `/combo/pending/${combo._id}`);
  return request;
}

// ---------- 관리자 콤보 수정 ----------

/** 관리자가 공개된 콤보의 기술 순서 오류를 고친다. 번호는 유지하고 chainKey 중복을 검사한다. */
export async function adminUpdateTechniques(comboParam: string, techniquesInput: unknown) {
  await dbConnect();
  const combo: any = await findComboByParam(comboParam);
  if (!combo) throw new ServiceError(404, 'Combo not found');
  const techniqueIds = await parseTechniqueIds(techniquesInput);
  const chainKey = buildChainKey(techniqueIds.map(String));
  const clash = await findActiveByChainKey(chainKey, combo._id);
  if (clash) {
    const info = duplicateInfo(clash, { id: '', isAdmin: true });
    throw new ServiceError(409, duplicateMessage(info), { existing: info });
  }
  try {
    await Combo.updateOne({ _id: combo._id }, { $set: { techniques: techniqueIds, chainKey } });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new ServiceError(409, '같은 기술 순서의 콤보가 이미 있어요.');
    throw error;
  }
  return combo._id;
}
