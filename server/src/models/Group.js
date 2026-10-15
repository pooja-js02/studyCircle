import mongoose from 'mongoose';

export const PRIVACY = ['open', 'approval', 'invite'];

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', trim: true, maxlength: 500 },
    tags: { type: [String], default: [] }, // stored lowercase; exam chips match these
    privacy: { type: String, enum: PRIVACY, default: 'approval' },
    inviteCode: { type: String, required: true, unique: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    settings: {
      studyBotEnabled: { type: Boolean, default: true },
      chatLockDuringFocus: { type: Boolean, default: false },
    },
    memberCount: { type: Number, default: 1 },
    notesCount: { type: Number, default: 0 },
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

groupSchema.index({ name: 'text', tags: 'text' });
groupSchema.index({ privacy: 1, tags: 1 });

export const Group = mongoose.model('Group', groupSchema);
