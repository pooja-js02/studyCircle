import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    avatarUrl: { type: String, default: null },
    avatarStorage: {
      provider: { type: String, default: null },
      key: { type: String, default: null },
      resourceType: { type: String, default: null },
      ext: { type: String, default: null },
    },
    // FR-PRIV-04: private fields are excluded from every query unless explicitly selected
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, select: false },
    mobile: { type: String, required: true, unique: true, select: false }, // stored as +91XXXXXXXXXX
    passwordHash: { type: String, required: true, select: false },
    platformRole: { type: String, enum: ['user', 'superadmin'], default: 'user' },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: null },
    // Shared portfolio demo accounts: destructive actions are blocked so the demo stays intact
    isDemo: { type: Boolean, default: false },
    // Reserved account that sends AI replies; cannot log in
    isBot: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
