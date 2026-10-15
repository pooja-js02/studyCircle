import mongoose from 'mongoose';
import { Group, Membership } from '../models/index.js';
import { forbidden, notFound } from '../utils/AppError.js';

/**
 * NFR-MNT-03 / NFR-SEC-01: shared group permission check.
 * Loads req.group and req.membership; 'member' allows any member, 'admin' only the group admin.
 * With { allowSuperadmin: true } the platform superadmin may pass without being a member
 * (moderation: reading a group and removing notes). req.membership is then null.
 */
export function requireGroupRole(minRole = 'member', { allowSuperadmin = false } = {}) {
  return async (req, _res, next) => {
    try {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) throw notFound('Group not found.');
      const [group, membership] = await Promise.all([
        Group.findById(id),
        Membership.findOne({ group: id, user: req.user.id }),
      ]);
      if (!group) throw notFound('Group not found.');
      const superadmin = allowSuperadmin && req.user.role === 'superadmin';
      if (!membership && !superadmin) throw forbidden('You are not a member of this group.');
      if (minRole === 'admin' && membership?.role !== 'admin') {
        throw forbidden('Only the group admin can do that.');
      }
      req.group = group;
      req.membership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
}
