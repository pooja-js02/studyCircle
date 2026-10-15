import mongoose from 'mongoose';
import { Message } from '../models/index.js';
import { emitToGroup } from '../services/realtime.js';
import { populateSender, serializeMessage } from '../services/messageService.js';
import { notFound } from '../utils/AppError.js';

export const PAGE_SIZE = 30; // FR-CHAT-03

// GET ?before=<id> loads older history; ?around=<id> opens at a mentioned message (FR-CHAT-09)
export async function listMessages(req, res) {
  const { before, around } = req.validQuery;
  const groupId = req.group._id;

  if (around) {
    const anchor = await Message.findOne({ _id: around, group: groupId }).lean();
    if (!anchor) throw notFound('That message is no longer available.');
    const [older, newer] = await Promise.all([
      populateSender(Message.find({ group: groupId, createdAt: { $lte: anchor.createdAt } }).sort({ createdAt: -1 }).limit(PAGE_SIZE / 2)).lean(),
      populateSender(Message.find({ group: groupId, createdAt: { $gt: anchor.createdAt } }).sort({ createdAt: 1 }).limit(PAGE_SIZE / 2)).lean(),
    ]);
    const messages = [...older.reverse(), ...newer];
    return res.json({ messages: messages.map(serializeMessage), hasMore: older.length === PAGE_SIZE / 2, hasNewer: newer.length === PAGE_SIZE / 2 });
  }

  const filter = { group: groupId };
  if (before) {
    const pivot = await Message.findOne({ _id: before, group: groupId }).select('createdAt').lean();
    if (pivot) filter.createdAt = { $lt: pivot.createdAt };
  }
  const rows = await populateSender(Message.find(filter).sort({ createdAt: -1 }).limit(PAGE_SIZE + 1)).lean();
  const hasMore = rows.length > PAGE_SIZE;
  const messages = rows.slice(0, PAGE_SIZE).reverse();
  res.json({ messages: messages.map(serializeMessage), hasMore, hasNewer: false });
}

// FR-CHAT-12: the group admin can delete any message
export async function deleteMessage(req, res) {
  const { messageId } = req.params;
  if (!mongoose.isValidObjectId(messageId)) throw notFound('Message not found.');
  const msg = await Message.findOne({ _id: messageId, group: req.group._id });
  if (!msg) throw notFound('Message not found.');
  msg.isDeleted = true;
  await msg.save();
  emitToGroup(req.group._id, 'chat:deleted', { groupId: String(req.group._id), messageId });
  res.status(204).end();
}
