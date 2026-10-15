import mongoose from 'mongoose';
import { Group, JoinRequest, Membership, Message, Note, Notification, User } from '../models/index.js';
import { addMember, removeMember } from '../services/membershipService.js';
import { notify } from '../services/notificationService.js';
import { closeGroupRoom, emitToGroup, joinUserToGroup } from '../services/realtime.js';
import { deleteFile } from '../services/storageService.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/AppError.js';
import { generateInviteCode } from '../utils/inviteCode.js';
import { publicUser, PUBLIC_USER_FIELDS } from '../utils/publicUser.js';

const PAGE_SIZE = 24;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function groupCard(g, myState = 'none') {
  return {
    _id: String(g._id),
    name: g.name,
    description: g.description,
    tags: g.tags,
    privacy: g.privacy,
    memberCount: g.memberCount,
    notesCount: g.notesCount,
    ratingAverage: g.ratingAverage,
    ratingCount: g.ratingCount,
    myState, // none | pending | joined   (FR-REQ-03)
  };
}

// For each group, is the signed-in user a member, waiting, or neither?
async function statesFor(userId, groupIds) {
  const states = new Map();
  if (!userId || !groupIds.length) return states;
  const [memberships, pending] = await Promise.all([
    Membership.find({ user: userId, group: { $in: groupIds } }).select('group').lean(),
    JoinRequest.find({ user: userId, group: { $in: groupIds }, status: 'pending' }).select('group').lean(),
  ]);
  pending.forEach((r) => states.set(String(r.group), 'pending'));
  memberships.forEach((m) => states.set(String(m.group), 'joined'));
  return states;
}

// FR-GRP-08: search Open and Approval groups by name, tag or exam
export async function listGroups(req, res) {
  const { search, tags, page } = req.validQuery;
  const filter = { privacy: { $in: ['open', 'approval'] } };
  if (tags.length) filter.tags = { $in: tags };
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { tags: rx }, { description: rx }];
  }
  const [groups, total] = await Promise.all([
    Group.find(filter)
      .sort({ memberCount: -1, createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    Group.countDocuments(filter),
  ]);
  const states = await statesFor(req.user?.id, groups.map((g) => g._id));
  res.json({ groups: groups.map((g) => groupCard(g, states.get(String(g._id)))), total, page, pageSize: PAGE_SIZE });
}

// FR-GRP-07: sidebar of my groups with unread count and mention badge
export async function myGroups(req, res) {
  const me = new mongoose.Types.ObjectId(req.user.id);
  const memberships = await Membership.find({ user: me }).populate('group').lean();
  const rows = await Promise.all(
    memberships
      .filter((m) => m.group)
      .map(async (m) => {
        const unreadFilter = { group: m.group._id, kind: 'user', createdAt: { $gt: m.lastReadAt }, sender: { $ne: me }, isDeleted: false };
        const [unreadCount, mentionCount, last] = await Promise.all([
          Message.countDocuments(unreadFilter),
          Message.countDocuments({ ...unreadFilter, $or: [{ mentions: me }, { mentionsEveryone: true }] }),
          Message.findOne({ group: m.group._id, isDeleted: false }).sort({ createdAt: -1 }).populate('sender', 'name').lean(),
        ]);
        return {
          ...groupCard(m.group, 'joined'),
          role: m.role,
          isMuted: m.isMuted,
          unreadCount,
          mentionCount,
          lastMessage: last
            ? { text: last.text.slice(0, 80), senderName: last.sender?.name || null, kind: last.kind, createdAt: last.createdAt }
            : null,
          lastActivityAt: last?.createdAt || m.joinedAt,
        };
      })
  );
  rows.sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt));
  res.json({ groups: rows });
}

async function previewPayload(group, userId) {
  const [creator, admin, membership, pending] = await Promise.all([
    User.findById(group.createdBy).select(PUBLIC_USER_FIELDS).lean(),
    Membership.findOne({ group: group._id, role: 'admin' }).populate('user', PUBLIC_USER_FIELDS).lean(),
    userId ? Membership.findOne({ group: group._id, user: userId }).lean() : null,
    userId ? JoinRequest.findOne({ group: group._id, user: userId, status: 'pending' }).lean() : null,
  ]);
  const myState = membership ? 'joined' : pending ? 'pending' : 'none';
  return {
    ...groupCard(group, myState),
    createdAt: group.createdAt,
    createdBy: publicUser(creator),
    admin: publicUser(admin?.user),
    myRole: membership?.role || null,
    pendingRequestId: pending ? String(pending._id) : null,
    // Members see settings; only the admin sees the invite code
    settings: membership ? group.settings : undefined,
    inviteCode: membership?.role === 'admin' ? group.inviteCode : undefined,
  };
}

// FR-GRP-09 public preview; FR-GRP-17 invite-only groups only through a valid invite
export async function getGroup(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound('Group not found.');
  const group = await Group.findById(req.params.id).lean();
  if (!group) throw notFound('Group not found.');
  if (group.privacy === 'invite' && req.user?.role !== 'superadmin') {
    const isMember = req.user && (await Membership.exists({ group: group._id, user: req.user.id }));
    if (!isMember) throw notFound('Group not found.');
  }
  res.json({ group: await previewPayload(group, req.user?.id) });
}

export async function getGroupByInvite(req, res) {
  const group = await Group.findOne({ inviteCode: req.params.code.toUpperCase() }).lean();
  if (!group) throw notFound('That invite code is not valid.');
  res.json({ group: await previewPayload(group, req.user?.id) });
}

export async function createGroup(req, res) {
  const { name, description, tags, privacy } = req.body;
  let group;
  for (let attempt = 0; !group; attempt++) {
    try {
      group = await Group.create({ name, description, tags, privacy, createdBy: req.user.id, inviteCode: generateInviteCode() });
    } catch (err) {
      if (err.code !== 11000 || attempt > 4) throw err; // retry on an invite-code collision
    }
  }
  // FR-GRP-02: the creator is the group admin
  await Membership.create({ group: group._id, user: req.user.id, role: 'admin' });
  joinUserToGroup(req.user.id, group._id);
  res.status(201).json({ group: await previewPayload(group.toObject(), req.user.id) });
}

// FR-GRP-10
export async function updateGroup(req, res) {
  const { name, description, tags, privacy, settings } = req.body;
  const group = req.group;
  if (name !== undefined) group.name = name;
  if (description !== undefined) group.description = description;
  if (tags !== undefined) group.tags = tags;
  if (privacy !== undefined) group.privacy = privacy;
  if (settings) Object.assign(group.settings, settings);
  await group.save();
  emitToGroup(group._id, 'group:updated', { groupId: String(group._id) });
  res.json({ group: await previewPayload(group.toObject(), req.user.id) });
}

export async function regenerateInvite(req, res) {
  const group = req.group;
  for (let attempt = 0; ; attempt++) {
    try {
      group.inviteCode = generateInviteCode();
      await group.save();
      break;
    } catch (err) {
      if (err.code !== 11000 || attempt > 4) throw err;
    }
  }
  res.json({ inviteCode: group.inviteCode });
}

// FR-GRP-15: delete after typing the group's name
export async function deleteGroup(req, res) {
  const group = req.group;
  if (req.user.isDemo) throw forbidden('Demo accounts cannot delete groups. Create your own account to try this.');
  if (req.body.confirmName.trim() !== group.name) throw badRequest('The name you typed does not match the group name.');

  const notes = await Note.find({ group: group._id, type: 'file' }).select('storage').lean();
  emitToGroup(group._id, 'group:deleted', { groupId: String(group._id), groupName: group.name });
  closeGroupRoom(group._id);
  await Promise.all([
    Membership.deleteMany({ group: group._id }),
    Message.deleteMany({ group: group._id }),
    Note.deleteMany({ group: group._id }),
    JoinRequest.deleteMany({ group: group._id }),
    Notification.deleteMany({ group: group._id }),
    Group.deleteOne({ _id: group._id }),
  ]);
  await Promise.all(notes.map((n) => deleteFile(n.storage)));
  res.status(204).end();
}

// FR-GRP-03: Open groups are joined instantly
export async function joinOpenGroup(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound('Group not found.');
  const group = await Group.findById(req.params.id);
  if (!group || group.privacy === 'invite') throw notFound('Group not found.');
  if (group.privacy !== 'open') throw forbidden('This group needs admin approval. Send a join request instead.');
  const user = await User.findById(req.user.id).select('name');
  await addMember(group, user);
  res.status(201).json({ groupId: String(group._id) });
}

// FR-GRP-04: anyone with the invite code joins directly
export async function joinByInvite(req, res) {
  const group = await Group.findOne({ inviteCode: req.params.inviteCode.toUpperCase() });
  if (!group) throw notFound('That invite code is not valid.');
  const user = await User.findById(req.user.id).select('name');
  await addMember(group, user);
  res.status(201).json({ groupId: String(group._id) });
}

export async function listMembers(req, res) {
  const members = await Membership.find({ group: req.group._id }).populate('user', PUBLIC_USER_FIELDS).lean();
  const rows = members
    .filter((m) => m.user)
    .map((m) => ({ user: publicUser(m.user), role: m.role, joinedAt: m.joinedAt }))
    .sort((a, b) => (a.role === b.role ? a.user.name.localeCompare(b.user.name) : a.role === 'admin' ? -1 : 1));
  res.json({ members: rows });
}

// FR-GRP-12
export async function removeMemberHandler(req, res) {
  const { userId } = req.params;
  if (userId === req.user.id) throw badRequest('You cannot remove yourself. Transfer admin first, then leave.');
  if (!mongoose.isValidObjectId(userId)) throw notFound('Member not found.');
  const target = await Membership.findOne({ group: req.group._id, user: userId }).populate('user', 'name');
  if (!target) throw notFound('Member not found.');
  await removeMember(req.group, target.user._id, target.user.name, 'removed');
  await notify([target.user._id], {
    type: 'removed_from_group',
    group: req.group._id,
    groupName: req.group.name,
    actor: req.user.id,
    text: `You were removed from ${req.group.name}`,
  });
  res.status(204).end();
}

// FR-GRP-13 / FR-GRP-14
export async function leaveGroup(req, res) {
  if (req.membership.role === 'admin') {
    const others = await Membership.countDocuments({ group: req.group._id, user: { $ne: req.user.id } });
    throw conflict(
      others
        ? 'Transfer admin to another member before you leave.'
        : 'You are the only member. Delete the group instead of leaving it.'
    );
  }
  await removeMember(req.group, req.user.id, req.user.name, 'left');
  res.status(204).end();
}

export async function transferAdmin(req, res) {
  const { userId } = req.body;
  if (userId === req.user.id) throw badRequest('You are already the admin.');
  const target = await Membership.findOne({ group: req.group._id, user: userId });
  if (!target) throw notFound('That person is not a member of this group.');
  target.role = 'admin';
  req.membership.role = 'member';
  await Promise.all([target.save(), req.membership.save()]);
  await notify([userId], {
    type: 'admin_transferred',
    group: req.group._id,
    groupName: req.group.name,
    actor: req.user.id,
    text: `You are now the admin of ${req.group.name}`,
  });
  emitToGroup(req.group._id, 'group:updated', { groupId: String(req.group._id) });
  res.json({ ok: true });
}
