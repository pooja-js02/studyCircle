import mongoose from 'mongoose';
import { Group, JoinRequest, Membership, User } from '../models/index.js';
import { addMember } from '../services/membershipService.js';
import { notify } from '../services/notificationService.js';
import { emitToUser } from '../services/realtime.js';
import { conflict, forbidden, notFound } from '../utils/AppError.js';
import { publicUser, PUBLIC_USER_FIELDS } from '../utils/publicUser.js';

const REJECT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // FR-REQ-07

function serializeRequest(r) {
  return {
    _id: String(r._id),
    group: String(r.group),
    user: publicUser(r.user),
    message: r.message,
    status: r.status,
    createdAt: r.createdAt,
  };
}

async function adminOf(groupId) {
  const admin = await Membership.findOne({ group: groupId, role: 'admin' }).select('user').lean();
  return admin?.user;
}

// FR-REQ-01, FR-REQ-02, FR-REQ-07, FR-REQ-08
export async function createRequest(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw notFound('Group not found.');
  const group = await Group.findById(id);
  if (!group || group.privacy === 'invite') throw notFound('Group not found.');
  if (group.privacy === 'open') throw conflict('This group is open. Join it directly.');
  if (await Membership.exists({ group: id, user: req.user.id })) throw conflict('You are already a member of this group.');
  if (await JoinRequest.exists({ group: id, user: req.user.id, status: 'pending' })) {
    throw conflict('You already have a pending request for this group.');
  }
  const lastRejected = await JoinRequest.findOne({ group: id, user: req.user.id, status: 'rejected' }).sort({ reviewedAt: -1 }).lean();
  if (lastRejected && Date.now() - lastRejected.reviewedAt < REJECT_COOLDOWN_MS) {
    const retryAt = new Date(lastRejected.reviewedAt.getTime() + REJECT_COOLDOWN_MS);
    throw conflict(`Your last request was declined. You can ask again after ${retryAt.toDateString()}.`, { retryAt });
  }

  const request = await JoinRequest.create({ group: id, user: req.user.id, message: req.body.message });
  await request.populate('user', PUBLIC_USER_FIELDS);
  const payload = serializeRequest(request);

  const adminId = await adminOf(id);
  if (adminId) {
    emitToUser(adminId, 'request:new', { groupId: id, groupName: group.name, request: payload });
    await notify([adminId], {
      type: 'join_request',
      group: group._id,
      groupName: group.name,
      actor: req.user.id,
      refId: request._id,
      text: `${req.user.name} asked to join ${group.name}`,
    });
  }
  res.status(201).json({ request: payload });
}

// FR-REQ-09
export async function cancelRequest(req, res) {
  const { id, reqId } = req.params;
  if (!mongoose.isValidObjectId(reqId)) throw notFound('Request not found.');
  const request = await JoinRequest.findOne({ _id: reqId, group: id, status: 'pending' });
  if (!request) throw notFound('Request not found.');
  if (String(request.user) !== req.user.id) throw forbidden('You can only cancel your own request.');
  request.status = 'cancelled';
  await request.save();
  const adminId = await adminOf(id);
  if (adminId) emitToUser(adminId, 'request:reviewed', { groupId: id, requestId: reqId, status: 'cancelled' });
  res.status(204).end();
}

// FR-REQ-04
export async function listRequests(req, res) {
  const requests = await JoinRequest.find({ group: req.group._id, status: 'pending' })
    .sort({ createdAt: -1 })
    .populate('user', PUBLIC_USER_FIELDS)
    .lean();
  res.json({ requests: requests.filter((r) => r.user).map(serializeRequest) });
}

// FR-REQ-05, FR-REQ-06, FR-REQ-07
export async function reviewRequest(req, res) {
  const { reqId } = req.params;
  if (!mongoose.isValidObjectId(reqId)) throw notFound('Request not found.');
  const request = await JoinRequest.findOne({ _id: reqId, group: req.group._id });
  if (!request) throw notFound('Request not found.');
  if (request.status !== 'pending') throw conflict('This request has already been handled.');

  const approve = req.body.action === 'approve';
  request.status = approve ? 'approved' : 'rejected';
  request.reviewedBy = req.user.id;
  request.reviewedAt = new Date();
  await request.save();

  const group = req.group;
  if (approve) {
    const user = await User.findById(request.user).select('name');
    if (user) await addMember(group, user);
  }
  emitToUser(request.user, 'request:reviewed', { groupId: String(group._id), groupName: group.name, status: request.status });
  emitToUser(req.user.id, 'request:reviewed', { groupId: String(group._id), requestId: reqId, status: request.status });
  await notify([request.user], {
    type: approve ? 'request_approved' : 'request_rejected',
    group: group._id,
    groupName: group.name,
    actor: req.user.id,
    refId: request._id,
    text: approve ? `You're in! Your request to join ${group.name} was approved` : `Your request to join ${group.name} was declined`,
  });
  res.json({ status: request.status });
}
