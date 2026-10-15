import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = [
  'join_request',
  'request_approved',
  'request_rejected',
  'mention',
  'new_note',
  'removed_from_group',
  'admin_transferred',
];

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: NOTIFICATION_TYPES, required: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
  groupName: { type: String, default: '' },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  refId: { type: mongoose.Schema.Types.ObjectId, default: null }, // message, note or request id
  text: { type: String, default: '' },
  read: { type: Boolean, default: false },
  // SRS 5.3: notifications are kept for 90 days
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
});

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
