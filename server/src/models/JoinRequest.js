import mongoose from 'mongoose';

const joinRequestSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, default: '', maxlength: 300 },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// FR-REQ-02: one pending request per user per group. Partial, so repeated
// rejections over time never collide with each other.
joinRequestSchema.index(
  { group: 1, user: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);
joinRequestSchema.index({ group: 1, status: 1 });

export const JoinRequest = mongoose.model('JoinRequest', joinRequestSchema);
