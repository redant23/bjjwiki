import mongoose, { Schema, Model } from 'mongoose';

// 원자적 순번 발급용. _id가 카운터 이름이다 (콤보 번호는 'combo').
export interface ICounter {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

const Counter: Model<ICounter> =
  mongoose.models.Counter || mongoose.model<ICounter>('Counter', CounterSchema);

export default Counter;
