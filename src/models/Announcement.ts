import mongoose, { Schema, Document, Model } from 'mongoose';

// 홈 상단 티커에 보이는 운영 공지. 관리자가 직접 작성하며, 기술 수정 내역과는 무관하다.
export interface IAnnouncement extends Document {
  text: string;
  href?: string | null; // 사이트 내 경로 또는 http(s) 주소 (선택)
  active: boolean;
  expiresAt?: Date | null; // 없으면 만료 없음
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema: Schema = new Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 200 },
    href: { type: String, default: null },
    active: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

AnnouncementSchema.index({ active: 1, expiresAt: 1, createdAt: -1 });

const Announcement: Model<IAnnouncement> =
  mongoose.models.Announcement || mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema);

export default Announcement;
