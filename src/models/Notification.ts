import mongoose, { Schema, Document, Model } from 'mongoose';

export type NotificationType =
  | 'request_approved'
  | 'request_rejected'
  | 'new_request'
  | 'combo_request_received'
  | 'combo_approved'
  | 'combo_rejected'
  | 'combo_new_request';

export interface INotification extends Document {
  user: mongoose.Types.ObjectId;
  type: NotificationType;
  message: string;
  relatedRequestId?: mongoose.Types.ObjectId;
  /** 알림을 눌렀을 때 이동할 앱 내 경로. 없으면 유형별 기본 경로 */
  link?: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'request_approved',
        'request_rejected',
        'new_request',
        'combo_request_received',
        'combo_approved',
        'combo_rejected',
        'combo_new_request',
      ],
      required: true,
    },
    message: { type: String, required: true },
    relatedRequestId: { type: Schema.Types.ObjectId },
    link: { type: String },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

NotificationSchema.index({ user: 1, createdAt: -1 });

const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
