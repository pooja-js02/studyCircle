import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/index.js';
import { detectFileType, CONTENT_TYPES, MAX_AVATAR_BYTES } from '../services/fileCheck.js';
import { readFile, saveFile, deleteFile } from '../services/storageService.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../utils/AppError.js';
import { selfUser } from '../utils/publicUser.js';

const SELF_FIELDS = '+email +mobile';

export async function getMe(req, res) {
  const user = await User.findById(req.user.id).select(SELF_FIELDS);
  res.json({ user: selfUser(user) });
}

export async function updateMe(req, res) {
  const { name, mobile, currentPassword, removeAvatar } = req.body;
  const user = await User.findById(req.user.id).select(`${SELF_FIELDS} +passwordHash`);

  if (mobile && mobile !== user.mobile) {
    if (user.isDemo) throw forbidden('Demo accounts cannot change the mobile number.');
    // FR-AUTH-08: re-enter the password before changing the recovery number
    if (!(await bcrypt.compare(currentPassword || '', user.passwordHash))) {
      throw new AppError(401, 'invalid_credentials', 'Current password is incorrect.', { field: 'currentPassword' });
    }
    if (await User.exists({ mobile, _id: { $ne: user._id } })) {
      throw conflict('An account with this mobile number already exists.', { field: 'mobile' });
    }
    user.mobile = mobile;
  }
  if (name) user.name = name;
  if (removeAvatar && user.avatarStorage?.key) {
    await deleteFile(user.avatarStorage);
    user.avatarStorage = {};
    user.avatarUrl = null;
  }
  await user.save();
  res.json({ user: selfUser(user) });
}

// Name and avatar are what everyone may see (FR-PRIV-03), so avatars are served without auth.
export async function uploadAvatar(req, res) {
  if (!req.file) throw badRequest('Choose an image to upload.');
  const ext = await detectFileType(req.file.buffer, ['png', 'jpg']);
  if (!ext) throw badRequest('Avatars must be PNG or JPG images.');

  const user = await User.findById(req.user.id).select(SELF_FIELDS);
  const previous = user.avatarStorage?.key ? { ...user.avatarStorage.toObject() } : null;
  const stored = await saveFile(req.file.buffer, { folder: 'avatars', ext });
  user.avatarStorage = { ...stored, ext };
  user.avatarUrl = `/api/avatars/${user._id}?v=${Date.now()}`;
  await user.save();
  if (previous) await deleteFile(previous);
  res.json({ user: selfUser(user) });
}

export async function serveAvatar(req, res) {
  if (!mongoose.isValidObjectId(req.params.userId)) throw notFound();
  const user = await User.findById(req.params.userId).select('avatarStorage').lean();
  const stored = user?.avatarStorage;
  if (!stored?.key) throw notFound();
  const stream = await readFile(stored, stored.ext);
  res.setHeader('Content-Type', CONTENT_TYPES[stored.ext]);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  stream.pipe(res);
}

export { MAX_AVATAR_BYTES };
