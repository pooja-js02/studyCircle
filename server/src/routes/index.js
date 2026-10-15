import { Router } from 'express';
import * as authC from '../controllers/authController.js';
import * as meC from '../controllers/meController.js';
import * as groupC from '../controllers/groupController.js';
import * as requestC from '../controllers/requestController.js';
import * as messageC from '../controllers/messageController.js';
import * as noteC from '../controllers/noteController.js';
import * as notifC from '../controllers/notificationController.js';
import { auth, optionalAuth } from '../middleware/auth.js';
import { requireGroupRole } from '../middleware/requireGroupRole.js';
import { authLimiter } from '../middleware/rateLimits.js';
import { uploadNoteFile, uploadOne } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import * as s from '../validators/schemas.js';

const r = Router();
const member = requireGroupRole('member');
// Platform superadmin may read any group and remove notes without joining it
const memberOrSuperadmin = requireGroupRole('member', { allowSuperadmin: true });
const admin = requireGroupRole('admin');

// Auth (public, rate limited)
r.post('/auth/register', authLimiter, validate(s.registerSchema), h(authC.register));
r.post('/auth/login', authLimiter, validate(s.loginSchema), h(authC.login));

// Profile
r.get('/me', auth, h(meC.getMe));
r.patch('/me', auth, validate(s.updateMeSchema), h(meC.updateMe));
r.post('/me/avatar', auth, uploadOne('avatar', meC.MAX_AVATAR_BYTES), h(meC.uploadAvatar));
r.get('/avatars/:userId', h(meC.serveAvatar));

// Groups — fixed paths before /:id
r.get('/groups', optionalAuth, validate(s.searchGroupsSchema, 'query'), h(groupC.listGroups));
r.get('/groups/mine', auth, h(groupC.myGroups));
r.get('/groups/invite/:code', optionalAuth, h(groupC.getGroupByInvite));
r.post('/groups/join/:inviteCode', auth, h(groupC.joinByInvite));
r.post('/groups', auth, validate(s.createGroupSchema), h(groupC.createGroup));
r.get('/groups/:id', optionalAuth, h(groupC.getGroup));
r.patch('/groups/:id', auth, admin, validate(s.updateGroupSchema), h(groupC.updateGroup));
r.delete('/groups/:id', auth, admin, validate(s.deleteGroupSchema), h(groupC.deleteGroup));
r.post('/groups/:id/join', auth, h(groupC.joinOpenGroup));
r.post('/groups/:id/invite-code', auth, admin, h(groupC.regenerateInvite));
r.post('/groups/:id/transfer-admin', auth, admin, validate(s.transferAdminSchema), h(groupC.transferAdmin));

// Join requests
r.post('/groups/:id/requests', auth, validate(s.joinRequestSchema), h(requestC.createRequest));
r.delete('/groups/:id/requests/:reqId', auth, h(requestC.cancelRequest));
r.get('/groups/:id/requests', auth, admin, h(requestC.listRequests));
r.patch('/groups/:id/requests/:reqId', auth, admin, validate(s.reviewRequestSchema), h(requestC.reviewRequest));

// Members
r.get('/groups/:id/members', auth, memberOrSuperadmin, h(groupC.listMembers));
r.delete('/groups/:id/members/me', auth, member, h(groupC.leaveGroup));
r.delete('/groups/:id/members/:userId', auth, admin, h(groupC.removeMemberHandler));

// Messages (sending happens over Socket.io)
r.get('/groups/:id/messages', auth, memberOrSuperadmin, validate(s.messagesQuerySchema, 'query'), h(messageC.listMessages));
r.delete('/groups/:id/messages/:messageId', auth, admin, h(messageC.deleteMessage));

// Notes
r.get('/groups/:id/notes', auth, memberOrSuperadmin, validate(s.notesQuerySchema, 'query'), h(noteC.listNotes));
r.post('/groups/:id/notes', auth, member, uploadNoteFile, validate(s.createNoteSchema), h(noteC.createNote));
r.get('/groups/:id/notes/:noteId', auth, memberOrSuperadmin, h(noteC.getNote));
r.get('/groups/:id/notes/:noteId/file', auth, memberOrSuperadmin, h(noteC.streamNoteFile));
r.get('/groups/:id/notes/:noteId/file-link', auth, memberOrSuperadmin, h(noteC.fileLink));
r.get('/files/:token', h(noteC.serveFileByToken));
r.patch('/groups/:id/notes/:noteId', auth, member, validate(s.updateNoteSchema), h(noteC.updateNote));
r.delete('/groups/:id/notes/:noteId', auth, memberOrSuperadmin, h(noteC.deleteNote));

// Notifications
r.get('/notifications', auth, h(notifC.listNotifications));
r.patch('/notifications/read', auth, validate(s.markReadSchema), h(notifC.markRead));

export default r;
