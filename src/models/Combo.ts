import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICombo extends Document {
  name: string;
  techniques: mongoose.Types.ObjectId[];
  gearType: 'gi' | 'nogi';
  videoUrl?: string;
  photoUrl?: string;
  createdBy: mongoose.Types.ObjectId;
  saveCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ComboSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    techniques: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Technique' }],
      validate: {
        validator: (v: mongoose.Types.ObjectId[]) => Array.isArray(v) && v.length >= 2,
        message: '콤보는 최소 2개 이상의 기술로 이루어져야 합니다.',
      },
    },
    // 영상 복장. 구성 기술의 유형과 무관하게 등록자가 고른다.
    gearType: { type: String, enum: ['gi', 'nogi'], required: true, index: true },
    videoUrl: { type: String },
    photoUrl: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    saveCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ComboSchema.index({ saveCount: -1 });

const Combo: Model<ICombo> =
  mongoose.models.Combo || mongoose.model<ICombo>('Combo', ComboSchema);

export default Combo;
