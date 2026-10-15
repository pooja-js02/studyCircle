import mongoose from 'mongoose';
import { User } from '../models/index.js';
import { verifyToken } from '../services/tokenService.js';
import { AppError, unauthorized, forbidden } from '../utils/AppError.js';

function readBearer(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

// Resolves the token to a live, non-banned account. Throws on failure.
export async function userFromToken(token) {
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new AppError(401, 'token_invalid', 'Your session has expired. Please log in again.');
  }
  if (!mongoose.isValidObjectId(payload.sub)) throw unauthorized();
  const user = await User.findById(payload.sub).select('name avatarUrl platformRole isBanned banReason isBot isDemo').lean();
  if (!user || user.isBot) throw new AppError(401, 'token_invalid', 'Your session has expired. Please log in again.');
  if (user.isBanned) throw new AppError(403, 'banned', `This account is banned${user.banReason ? `: ${user.banReason}` : '.'}`);
  return user;
}

export async function auth(req, _res, next) {
  try {
    const token = readBearer(req);
    if (!token) throw unauthorized();
    const user = await userFromToken(token);
    req.user = { id: String(user._id), role: user.platformRole, name: user.name, avatarUrl: user.avatarUrl, isDemo: user.isDemo };
    next();
  } catch (err) {
    next(err);
  }
}

// For public routes that show extra state (e.g. "Joined") to signed-in users.
export async function optionalAuth(req, _res, next) {
  const token = readBearer(req);
  if (!token) return next();
  try {
    const user = await userFromToken(token);
    req.user = { id: String(user._id), role: user.platformRole, name: user.name, avatarUrl: user.avatarUrl, isDemo: user.isDemo };
  } catch {
    // treat a bad token on a public route as a visitor
  }
  next();
}

export function requireSuperadmin(req, _res, next) {
  if (req.user?.role !== 'superadmin') return next(forbidden());
  next();
}
