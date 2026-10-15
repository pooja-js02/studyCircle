import mongoose from 'mongoose';

export const MAX_MESSAGE_LENGTH = 2000; // FR-CHAT-13

const messageSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null for system lines
    kind: { type: String, enum: ['user', 'system'], default: 'user' },
    text: { type: String, required: true, maxlength: MAX_MESSAGE_LENGTH },
    mentions: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    mentionsEveryone: { type: Boolean, default: false },
    isEdited: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ group: 1, createdAt: -1 });

export const Message = mongoose.model('Message', messageSchema);
