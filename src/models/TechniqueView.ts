import mongoose, { Schema, Model } from 'mongoose';

// 기술별 일 단위 조회수. 최근 7일/30일 인기 기술 집계용.
// 전체 조회수는 Technique.viewCount를 그대로 쓴다.
export interface ITechniqueView {
  technique: mongoose.Types.ObjectId;
  day: string; // 'YYYY-MM-DD' (KST)
  count: number;
}

const TechniqueViewSchema = new Schema<ITechniqueView>({
  technique: { type: Schema.Types.ObjectId, ref: 'Technique', required: true },
  day: { type: String, required: true },
  count: { type: Number, default: 0 },
});

TechniqueViewSchema.index({ technique: 1, day: 1 }, { unique: true });
TechniqueViewSchema.index({ day: 1 });

const TechniqueView: Model<ITechniqueView> =
  mongoose.models.TechniqueView ||
  mongoose.model<ITechniqueView>('TechniqueView', TechniqueViewSchema);

export default TechniqueView;
