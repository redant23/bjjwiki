import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITechnique extends Document {
  name: string;
  alt_names: string[];
  description: string;
  image_url?: string;
  video_url?: string;
  category: string;
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
    category: { type: String, required: true, index: true },
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
