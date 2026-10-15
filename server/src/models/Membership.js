import mongoose from 'mongoose';

// One admin per group; everyone else is a member (FR-GRP-11). There is no moderator role.
export const ROLES = ['admin', 'member'];

const membershipSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  role: { type: String, enum: ROLES, default: 'member' },
  joinedAt: { type: Date, default: Date.now },
  lastReadAt: { type: Date, default: Date.now },
  isMuted: { type: Boolean, default: false },
});

membershipSchema.index({ user: 1, group: 1 }, { unique: true });
membershipSchema.index({ group: 1 });

export const Membership = mongoose.model('Membership', membershipSchema);
