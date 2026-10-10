import mongoose, { Schema, Document, Model } from 'mongoose';
import type { DemoGearType } from '@/lib/combo-chain';

export type ComboStatus = 'pending' | 'published' | 'rejected';

export interface IComboDemo {
  _id: mongoose.Types.ObjectId;
  performer?: string;
  videoUrl?: string;
  /** 영상 속 복장. 영상이 없거나 모르면 unknown */
  gearType: DemoGearType;
  /** 중복 판정용 "영상ID@시작초". 서버에서만 만든다 */
  videoKey?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

export interface ICombo extends Document {
  /** 공개 순번. 승인(공개) 시점에 부여되고 바뀌지 않는다 */
  number?: number;
  techniques: mongoose.Types.ObjectId[];
  /** techniques의 id를 ">"로 이은 문자열. 같은 순서 중복 방지 기준 */
  chainKey: string;
  status: ComboStatus;
  publishedAt?: Date;
  demos: IComboDemo[];
  createdBy: mongoose.Types.ObjectId;
  saveCount: number;
  /** 레거시 보존 필드: UI에서 표시/입력하지 않는다 */
  name?: string;
  gearType?: 'gi' | 'nogi';
  videoUrl?: string;
  photoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DemoSchema = new Schema<IComboDemo>(
  {
    performer: { type: String, trim: true, maxlength: 40 },
    videoUrl: { type: String, trim: true },
    gearType: { type: String, enum: ['gi', 'nogi', 'unknown'], default: 'unknown' },
    videoKey: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: true }
);

const ComboSchema: Schema = new Schema(
  {
    number: { type: Number },
    techniques: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Technique' }],
      validate: {
        validator: (v: mongoose.Types.ObjectId[]) => Array.isArray(v) && v.length >= 2,
        message: '콤보는 최소 2개 이상의 기술로 이루어져야 합니다.',
      },
    },
    chainKey: { type: String, required: true },
    status: { type: String, enum: ['pending', 'published', 'rejected'], default: 'pending' },
    publishedAt: { type: Date },
    demos: { type: [DemoSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    saveCount: { type: Number, default: 0 },
    // 레거시 필드. 삭제하지 않고 보존만 한다.
    name: { type: String, trim: true },
    gearType: { type: String, enum: ['gi', 'nogi'] },
    videoUrl: { type: String },
    photoUrl: { type: String },
  },
  { timestamps: true }
);

ComboSchema.index({ saveCount: -1 });
ComboSchema.index({ status: 1, publishedAt: -1 });
// 번호는 공개된 콤보에만 있으므로 부분 유니크. 번호 없는 pending 문서끼리 충돌하지 않는다.
ComboSchema.index({ number: 1 }, { unique: true, partialFilterExpression: { number: { $type: 'number' } } });
// 같은 기술 순서는 pending + published 를 통틀어 하나만. rejected 가 되면 키가 풀린다.
ComboSchema.index(
  { chainKey: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending', 'published'] } } }
);

const Combo: Model<ICombo> =
  mongoose.models.Combo || mongoose.model<ICombo>('Combo', ComboSchema);

export default Combo;
