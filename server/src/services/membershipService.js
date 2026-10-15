import { Group, JoinRequest, Membership } from '../models/index.js';
import { conflict } from '../utils/AppError.js';
import { postSystemMessage } from './messageService.js';
import { emitToGroup, emitToUser, joinUserToGroup, removeUserFromGroup } from './realtime.js';

/**
 * Adds a user to a group and gives every open tab of theirs live access at once.
 * Used by Open joins, invite codes and approved requests.
 */
export async function addMember(group, user) {
  const exists = await Membership.exists({ group: group._id, user: user._id });
  if (exists) throw conflict('You are already a member of this group.');

  const membership = await Membership.create({ group: group._id, user: user._id, role: 'member' });
  await Group.updateOne({ _id: group._id }, { $inc: { memberCount: 1 } });
  // A pending request is no longer needed once the user is in
  await JoinRequest.updateMany({ group: group._id, user: user._id, status: 'pending' }, { status: 'cancelled' });

  joinUserToGroup(user._id, group._id);
  emitToUser(user._id, 'group:joined', { groupId: String(group._id) });
  emitToGroup(group._id, 'member:joined', { groupId: String(group._id) });
  await postSystemMessage(group._id, `${user.name} joined the group`);
  return membership;
}

/**
 * FR-GRP-12 / FR-GRP-13: ends the user's access to chat, notes and live events immediately.
 * @param {'left'|'removed'} reason
 */
export async function removeMember(group, userId, userName, reason) {
  await Membership.deleteOne({ group: group._id, user: userId });
  await Group.updateOne({ _id: group._id }, { $inc: { memberCount: -1 } });

  removeUserFromGroup(userId, group._id);
  emitToUser(userId, 'member:removed', { groupId: String(group._id), groupName: group.name, reason });
  emitToGroup(group._id, 'member:removed', { groupId: String(group._id), userId: String(userId) });
  if (reason === 'left') await postSystemMessage(group._id, `${userName} left the group`);
}
