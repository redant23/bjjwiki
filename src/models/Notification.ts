import mongoose, { Schema, Document, Model } from 'mongoose';

export type NotificationType = 'request_approved' | 'request_rejected' | 'new_request';

export interface INotification extends Document {
  user: mongoose.Types.ObjectId;
  type: NotificationType;
  message: string;
  relatedRequestId?: mongoose.Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['request_approved', 'request_rejected', 'new_request'],
      required: true,
    },
    message: { type: String, required: true },
    relatedRequestId: { type: Schema.Types.ObjectId, ref: 'TechniqueRequest' },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

NotificationSchema.index({ user: 1, createdAt: -1 });

const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
