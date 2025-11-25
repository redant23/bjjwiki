import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITechnique extends Document {
  name: string;
  alt_names: string[];
  description: string;
  image_url?: string;
  video_url?: string;
  main_category: string; // 대분류 (e.g., Guard, Submission, Takedown)
  sub_category?: string; // 중분류 (e.g., Half Guard, Closed Guard)
  detail_category?: string; // 하분류 (e.g., Deep Half Guard, Lockdown)
  situations?: {
    position: string; // 어떤 포지션에서 사용되는지 (e.g., "클로즈드 가드", "마운트")
    description?: string; // 해당 상황에서의 설명
    image_url?: string; // 상황별 이미지 (향후 추가)
    video_url?: string; // 상황별 영상 (향후 추가)
  }[];
  status: 'approved' | 'pending' | 'draft';
  is_current_version: boolean;
  original_technique_id?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TechniqueSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    alt_names: { type: [String], default: [] },
    description: { type: String, required: true },
    image_url: { type: String },
    video_url: { type: String },
    main_category: { type: String, required: true, index: true },
    sub_category: { type: String, index: true },
    detail_category: { type: String, index: true },
    situations: [{
      position: { type: String },
      description: { type: String },
      image_url: { type: String },
      video_url: { type: String },
    }],
    status: {
      type: String,
      enum: ['approved', 'pending', 'draft'],
      default: 'pending',
      index: true,
    },
    is_current_version: { type: Boolean, default: false },
    original_technique_id: { type: Schema.Types.ObjectId, ref: 'Technique' },
  },
  { timestamps: true }
);

// Prevent recompilation of model in development
const Technique: Model<ITechnique> =
  mongoose.models.Technique || mongoose.model<ITechnique>('Technique', TechniqueSchema);

export default Technique;
