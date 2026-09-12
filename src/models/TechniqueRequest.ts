import mongoose, { Schema, Document, Model } from 'mongoose';

export type TechniqueRequestType = 'create' | 'edit';
export type TechniqueRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ITechniqueRequest extends Document {
  type: TechniqueRequestType;
  targetTechniqueId?: mongoose.Types.ObjectId | null;
  payload: Record<string, unknown>;
  status: TechniqueRequestStatus;
  submittedBy: mongoose.Types.ObjectId;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TechniqueRequestSchema: Schema = new Schema(
  {
    type: { type: String, enum: ['create', 'edit'], required: true },
    targetTechniqueId: { type: Schema.Types.ObjectId, ref: 'Technique', default: null, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewNote: { type: String },
  },
  { timestamps: true }
);

TechniqueRequestSchema.index({ status: 1, createdAt: -1 });

const TechniqueRequest: Model<ITechniqueRequest> =
  mongoose.models.TechniqueRequest ||
  mongoose.model<ITechniqueRequest>('TechniqueRequest', TechniqueRequestSchema);

export default TechniqueRequest;
