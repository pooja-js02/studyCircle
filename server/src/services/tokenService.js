import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// FR-AUTH-06: the token holds only the user ID and platform role.
export function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.platformRole }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

export function verifyToken(token) {
  const payload = jwt.verify(token, env.jwtSecret);
  if (payload.purpose) throw new Error('Not a session token');
  return payload;
}

// A <video> tag can't send an Authorization header, so it gets a URL with a
// 15-minute token that only opens this one note's file for this one user.
export function signFileToken({ userId, noteId }) {
  return jwt.sign({ purpose: 'note-file', sub: String(userId), nid: String(noteId) }, env.jwtSecret, { expiresIn: '15m' });
}

export function verifyFileToken(token) {
  const payload = jwt.verify(token, env.jwtSecret);
  if (payload.purpose !== 'note-file') throw new Error('Wrong token purpose');
  return payload;
}
