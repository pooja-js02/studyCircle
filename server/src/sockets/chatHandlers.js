import { Group, Membership, Message } from '../models/index.js';
import { notify } from '../services/notificationService.js';
import { groupRoom } from '../services/realtime.js';
import { serializeMessage } from '../services/messageService.js';
import { sendMessageSchema } from '../validators/schemas.js';
import { publicUser } from '../utils/publicUser.js';

const BURST = 8; // messages
const BURST_WINDOW_MS = 5000;

const fail = (ack, message, code = 'invalid_input') => typeof ack === 'function' && ack({ ok: false, error: { code, message } });

export function registerChatHandlers(io, socket) {
  const me = socket.data.user;
  let sentAt = [];

  // FR-CHAT-01..10: send a message; the ack lets the sender mark it sent or failed (FR-CHAT-04)
  socket.on('chat:send', async (raw, ack) => {
    try {
      const now = Date.now();
      sentAt = sentAt.filter((t) => now - t < BURST_WINDOW_MS);
      if (sentAt.length >= BURST) return fail(ack, 'You are sending messages too fast.', 'rate_limited');
      sentAt.push(now);

      const parsed = sendMessageSchema.safeParse(raw);
      if (!parsed.success) return fail(ack, parsed.error.issues[0].message);
      const { groupId, text, mentions, clientId } = parsed.data;

      // Membership is re-checked on every send: a removed member loses access at once
      const membership = await Membership.findOne({ group: groupId, user: me.id }).lean();
      if (!membership) return fail(ack, 'You are not a member of this group.', 'forbidden');
      const group = await Group.findById(groupId).select('name').lean();

      // FR-CHAT-06: keep only IDs of current members; FR-CHAT-10: @everyone is admin-only
      const memberIds = mentions.length
        ? (await Membership.find({ group: groupId, user: { $in: mentions } }).select('user').lean()).map((m) => String(m.user))
        : [];
      const mentionsEveryone = membership.role === 'admin' && /(^|\s)@everyone\b/i.test(text);

      const msg = await Message.create({ group: groupId, sender: me.id, text, mentions: memberIds, mentionsEveryone });
      const message = serializeMessage({ ...msg.toObject(), sender: { _id: me.id, name: me.name, avatarUrl: me.avatarUrl } });

      io.to(groupRoom(groupId)).emit('chat:new', { message, clientId });
      if (typeof ack === 'function') ack({ ok: true, message });

      // The sender has obviously read up to their own message
      await Membership.updateOne({ group: groupId, user: me.id }, { lastReadAt: msg.createdAt });

      // FR-CHAT-08: notify mentioned members wherever they are in the app
      let recipients = memberIds;
      if (mentionsEveryone) {
        recipients = (await Membership.find({ group: groupId }).select('user').lean()).map((m) => String(m.user));
      }
      recipients = recipients.filter((id) => id !== me.id);
      if (recipients.length) {
        const preview = text.length > 90 ? `${text.slice(0, 90)}…` : text;
        await notify(recipients, {
          type: 'mention',
          group: groupId,
          groupName: group?.name || '',
          actor: me.id,
          refId: msg._id,
          text: `${me.name} mentioned you in ${group?.name || 'a group'}: ${preview}`,
        });
        for (const id of recipients) {
          io.to(`user:${id}`).emit('mention:new', { groupId, messageId: String(msg._id), from: publicUser({ _id: me.id, name: me.name, avatarUrl: me.avatarUrl }) });
        }
      }
    } catch (err) {
      console.error('chat:send failed', err);
      fail(ack, 'Message could not be sent. Try again.', 'server_error');
    }
  });

  // FR-CHAT-11: typing indicator. Being in the group room already proves membership.
  socket.on('chat:typing', (raw) => {
    const groupId = String(raw?.groupId || '');
    if (!socket.rooms.has(groupRoom(groupId))) return;
    socket.to(groupRoom(groupId)).emit('chat:typing', { groupId, user: publicUser({ _id: me.id, name: me.name, avatarUrl: me.avatarUrl }) });
  });

  // Unread counts are measured from lastReadAt
  socket.on('chat:read', async (raw) => {
    const groupId = String(raw?.groupId || '');
    if (!socket.rooms.has(groupRoom(groupId))) return;
    await Membership.updateOne({ group: groupId, user: me.id }, { lastReadAt: new Date() }).catch(() => {});
  });
}
