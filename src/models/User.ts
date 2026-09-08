import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserSkill {
  technique: mongoose.Types.ObjectId;
  status: 'interested' | 'practicing' | 'frequently_used' | 'signature' | null;
  isFavorite: boolean;
}

export interface IUserCombo {
  name: string;
  techniques: mongoose.Types.ObjectId[];
}

export interface IUser extends Document {
  email: string;
  password: string;
  nickname: string;
  role: 'user' | 'admin';
  level: 'white' | 'blue' | 'purple' | 'brown' | 'black';
  stripe: number;
  period?: Date;
  mySkills: IUserSkill[];
  myCombo: IUserCombo[];
  createdAt: Date;
  updatedAt: Date;
}

export const MAX_STRIPES_BY_LEVEL: Record<IUser['level'], number> = {
  white: 4,
  blue: 4,
  purple: 4,
  brown: 4,
  black: 6,
};

const UserSkillSchema = new Schema<IUserSkill>(
  {
    technique: { type: Schema.Types.ObjectId, ref: 'Technique', required: true },
    status: {
      type: String,
      enum: ['interested', 'practicing', 'frequently_used', 'signature', null],
      default: null,
    },
    isFavorite: { type: Boolean, default: false },
  },
  { _id: false }
);

const ComboSchema = new Schema<IUserCombo>(
  {
    name: { type: String, required: true },
    techniques: [{ type: Schema.Types.ObjectId, ref: 'Technique' }],
  },
  { _id: true }
);

const UserSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, select: false },
    nickname: { type: String, required: true, unique: true, trim: true },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      index: true,
    },
    level: {
      type: String,
      enum: ['white', 'blue', 'purple', 'brown', 'black'],
      default: 'white',
    },
    stripe: {
      type: Number,
      min: 0,
      default: 0,
      validate: {
        validator: function (this: IUser, v: number) {
          return v <= MAX_STRIPES_BY_LEVEL[this.level];
        },
        message: '그랄 수가 벨트 등급의 최대치를 초과했습니다.',
      },
    },
    period: { type: Date },
    mySkills: { type: [UserSkillSchema], default: [] },
    myCombo: { type: [ComboSchema], default: [] },
  },
  { timestamps: true }
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
