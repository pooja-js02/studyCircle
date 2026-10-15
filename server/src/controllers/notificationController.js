import { Notification } from '../models/index.js';
import { serializeNotification } from '../services/notificationService.js';
import { PUBLIC_USER_FIELDS } from '../utils/publicUser.js';

// FR-NOTIF-02, FR-NOTIF-03
export async function listNotifications(req, res) {
  const [items, unreadCount] = await Promise.all([
    Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(40).populate('actor', PUBLIC_USER_FIELDS).lean(),
    Notification.countDocuments({ user: req.user.id, read: false }),
  ]);
  res.json({ notifications: items.map((n) => serializeNotification(n, n.actor)), unreadCount });
}

export async function markRead(req, res) {
  const filter = { user: req.user.id, read: false };
  if (req.body.ids?.length) filter._id = { $in: req.body.ids };
  await Notification.updateMany(filter, { read: true });
  const unreadCount = await Notification.countDocuments({ user: req.user.id, read: false });
  res.json({ unreadCount });
}
