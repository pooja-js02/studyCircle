import { Notification, User } from '../models/index.js';
import { publicUser, PUBLIC_USER_FIELDS } from '../utils/publicUser.js';
import { emitToUser } from './realtime.js';

export function serializeNotification(n, actor) {
  return {
    _id: String(n._id),
    type: n.type,
    group: n.group ? String(n.group) : null,
    groupName: n.groupName,
    refId: n.refId ? String(n.refId) : null,
    text: n.text,
    read: n.read,
    createdAt: n.createdAt,
    actor: actor ? publicUser(actor) : null,
  };
}

/**
 * Stores notifications and pushes them live to every open tab of each recipient (FR-NOTIF-02).
 * @param {string[]} userIds recipients
 * @param {{type, group, groupName, actor, refId, text}} data
 */
export async function notify(userIds, data) {
  const recipients = [...new Set(userIds.map(String))].filter((id) => id !== String(data.actor || ''));
  if (!recipients.length) return [];
  const docs = await Notification.insertMany(recipients.map((user) => ({ ...data, user })));
  const actor = data.actor ? await User.findById(data.actor).select(PUBLIC_USER_FIELDS).lean() : null;
  for (const doc of docs) {
    emitToUser(doc.user, 'notification:new', serializeNotification(doc, actor));
  }
  return docs;
}
