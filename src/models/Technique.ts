import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITechnique extends Document {
  // 1. Basic Identification
  slug: string; // Unique, auto-generated from name

  // 2. Name / Description (Multi-language)
  name: {
    ko: string;
    en?: string;
  };
  aka: {
    ko: string[];
    en?: string[];
  };
  description: {
    ko: string;
    en?: string;
  };

  // 3. Type / Role
  type: 'gi' | 'nogi' | 'both';
  primaryRole:
  | 'drill'
  | 'position'
  | 'guard'
  | 'guard_recovery'
  | 'guard_pass'
  | 'sweep'
  | 'submission'
  | 'escape'
  | 'transition'
  | 'leg_entry'
  | 'control_hold'
  | 'grip'
  | 'takedown';
  roleTags: string[]; // e.g., ['transition', 'sweep', 'backtake']
  difficulty: number; // 1-10
  order: number; // For custom sorting

  // 4. Position Flags
  isCorePosition?: boolean; // true if it's a base position (Side, Mount, etc.)
  positionType?: 'top' | 'bottom' | 'neutral';

  // 5. Hierarchy (Tree)
  parentId?: mongoose.Types.ObjectId;
  childrenIds: mongoose.Types.ObjectId[];
  level: number; // 1, 2, 3, 4...
  pathSlugs: string[]; // e.g., ['guard', 'open-guard', 'x-guard']

  // 6. Chaining
  sweepsFromHere: mongoose.Types.ObjectId[];
  submissionsFromHere: mongoose.Types.ObjectId[];
  escapesFromHere: mongoose.Types.ObjectId[];

  // 7. Media
  thumbnailUrl?: string;
  videos: {
    url: string;
    titleKo?: string;
    titleEn?: string;
  }[];
  images: {
    url: string;
    captionKo?: string;
    captionEn?: string;
    isPrimary?: boolean;
  }[];

  // 8. Metadata
  status: 'draft' | 'published' | 'archived';
  createdBy?: mongoose.Types.ObjectId;
  lastEditedBy?: mongoose.Types.ObjectId;
  viewCount: number;
  likeCount: number;

  createdAt: Date;
  updatedAt: Date;
}

const TechniqueSchema: Schema = new Schema(
  {
    // 1. Basic Identification
    slug: { type: String, required: true, unique: true, index: true },

    // 2. Name / Description
    name: {
      ko: { type: String, required: true },
      en: { type: String },
    },
    aka: {
      ko: { type: [String], default: [] },
      en: { type: [String], default: [] },
    },
    description: {
      ko: { type: String, required: true },
      en: { type: String },
    },

    // 3. Type / Role
    type: {
      type: String,
      enum: ['gi', 'nogi', 'both'],
      default: 'both',
      index: true,
    },
    primaryRole: {
      type: String,
      enum: [
        'drill',
        'position',
        'guard',
        'guard_recovery',
        'guard_pass',
        'sweep',
        'submission',
        'escape',
        'transition',
        'leg_entry',
        'control_hold',
        'grip',
        'takedown',
      ],
      required: true,
      index: true,
    },
    roleTags: { type: [String], default: [], index: true },
    difficulty: { type: Number, min: 1, max: 10, default: 1, index: true },
    order: { type: Number, default: 0, index: true },

    // 4. Position Flags
    isCorePosition: { type: Boolean, default: false, index: true },
    positionType: {
      type: String,
      enum: ['top', 'bottom', 'neutral'],
      index: true,
    },

    // 5. Hierarchy
    parentId: { type: Schema.Types.ObjectId, ref: 'Technique', default: null, index: true },
    childrenIds: [{ type: Schema.Types.ObjectId, ref: 'Technique' }],
    level: { type: Number, default: 1, index: true },
    pathSlugs: { type: [String], default: [], index: true },

    // 6. Chaining
    sweepsFromHere: [{ type: Schema.Types.ObjectId, ref: 'Technique', index: true }],
    submissionsFromHere: [{ type: Schema.Types.ObjectId, ref: 'Technique', index: true }],
    escapesFromHere: [{ type: Schema.Types.ObjectId, ref: 'Technique', index: true }],

    // 7. Media
    thumbnailUrl: { type: String },
    videos: [{
      url: { type: String, required: true },
      titleKo: String,
      titleEn: String,
    }],
    images: [{
      url: { type: String, required: true },
      captionKo: String,
      captionEn: String,
      isPrimary: Boolean,
    }],

    // 8. Metadata
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }, // Assuming User model exists or will exist
    lastEditedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    viewCount: { type: Number, default: 0, index: true },
    likeCount: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

// Index for text search
TechniqueSchema.index({
  'name.ko': 'text',
  'name.en': 'text',
  'aka.ko': 'text',
  'aka.en': 'text',
  'description.ko': 'text',
  'description.en': 'text'
});

// Compound Indexes
TechniqueSchema.index({ primaryRole: 1, type: 1, difficulty: 1 });
TechniqueSchema.index({ level: 1, order: 1 });
TechniqueSchema.index({ positionType: 1, isCorePosition: 1 });

// Prevent recompilation of model in development
const Technique: Model<ITechnique> =
  mongoose.models.Technique || mongoose.model<ITechnique>('Technique', TechniqueSchema);

export default Technique;
