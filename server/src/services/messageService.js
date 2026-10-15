import { Message } from '../models/index.js';
import { publicUser, PUBLIC_USER_FIELDS } from '../utils/publicUser.js';
import { emitToGroup } from './realtime.js';

export function serializeMessage(m) {
  return {
    _id: String(m._id),
    group: String(m.group),
    kind: m.kind,
    sender: m.sender && typeof m.sender === 'object' && 'name' in m.sender ? publicUser(m.sender) : null,
    // FR-CHAT-12: a removed message keeps its place but never its text
    text: m.isDeleted ? null : m.text,
    mentions: (m.mentions || []).map(String),
    mentionsEveryone: Boolean(m.mentionsEveryone),
    isDeleted: Boolean(m.isDeleted),
    isEdited: Boolean(m.isEdited),
    createdAt: m.createdAt,
  };
}

export const populateSender = (query) => query.populate('sender', PUBLIC_USER_FIELDS);

// "Aman Gill joined the group" lines in the chat
export async function postSystemMessage(groupId, text) {
  const msg = await Message.create({ group: groupId, kind: 'system', text });
  emitToGroup(groupId, 'chat:new', { message: serializeMessage(msg) });
  return msg;
}
