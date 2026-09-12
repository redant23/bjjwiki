import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICombo extends Document {
  name: string;
  techniques: mongoose.Types.ObjectId[];
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
