import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IImage extends Document {
  uploaderType: 'admin' | 'user';
  usage: 'technique_thumbnail' | 'technique_photo' | 'user_thumbnail';
  relatedId?: mongoose.Types.ObjectId; // User ID or Technique ID
  url: string;
  alt?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ImageSchema: Schema = new Schema(
  {
    uploaderType: {
      type: String,
      enum: ['admin', 'user'],
      required: true,
      default: 'user',
    },
    usage: {
      type: String,
      enum: ['technique_thumbnail', 'technique_photo', 'user_thumbnail'],
      required: true,
    },
    relatedId: { type: Schema.Types.ObjectId, index: true }, // Can reference different models, so no 'ref' is strictly enforced here, or we can make it dynamic
    url: { type: String, required: true },
    alt: { type: String },
  },
  { timestamps: true }
);

// Prevent recompilation
const ImageModel: Model<IImage> =
  mongoose.models.Image || mongoose.model<IImage>('Image', ImageSchema);

export default ImageModel;
