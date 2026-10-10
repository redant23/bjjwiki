import mongoose, { Schema, Document, Model } from 'mongoose';

export type ComboRequestType = 'create_combo' | 'add_demo' | 'edit_demo' | 'delete_demo';
export type ComboRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface IComboRequestPayload {
  /** create_combo: 첫 시연. add_demo / edit_demo: 새 값 */
  demo?: { performer?: string; videoUrl?: string; gearType?: string; videoKey?: string };
  /** edit_demo / delete_demo 대상 시연 */
  demoId?: mongoose.Types.ObjectId;
  /** 변경 전 스냅샷 (관리자 화면 비교용) */
  before?: { performer?: string; videoUrl?: string; gearType?: string };
}

export interface IComboRequest extends Document {
  combo: mongoose.Types.ObjectId;
  type: ComboRequestType;
  payload: IComboRequestPayload;
  requestedBy: mongoose.Types.ObjectId;
  status: ComboRequestStatus;
  reviewNote?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  /** 승인되어 공개된 번호 (create_combo) */
  resultNumber?: number;
  /** 반려 후 수정해 다시 낸 요청 */
  resubmittedAs?: mongoose.Types.ObjectId;
  /** 대기 중 같은 영상으로 중복 요청을 막는 키 ("콤보id|영상키") */
  dedupeKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ComboRequestSchema: Schema = new Schema(
  {
    combo: { type: Schema.Types.ObjectId, ref: 'Combo', required: true, index: true },
    type: {
      type: String,
      enum: ['create_combo', 'add_demo', 'edit_demo', 'delete_demo'],
      required: true,
    },
    payload: { type: Schema.Types.Mixed, default: {} },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    reviewNote: { type: String },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    resultNumber: { type: Number },
    resubmittedAs: { type: Schema.Types.ObjectId, ref: 'ComboRequest' },
    dedupeKey: { type: String },
  },
  { timestamps: true }
);

ComboRequestSchema.index({ status: 1, createdAt: -1 });
// 같은 콤보에 같은 영상(링크+시작 시간)으로 대기 중인 요청은 하나만.
ComboRequestSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { status: 'pending', dedupeKey: { $type: 'string' } } }
);

const ComboRequest: Model<IComboRequest> =
  mongoose.models.ComboRequest ||
  mongoose.model<IComboRequest>('ComboRequest', ComboRequestSchema);

export default ComboRequest;
