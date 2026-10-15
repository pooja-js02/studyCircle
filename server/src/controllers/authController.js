import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { signToken } from '../services/tokenService.js';
import { AppError, conflict } from '../utils/AppError.js';
import { selfUser } from '../utils/publicUser.js';

export const BCRYPT_COST = 10; // NFR-SEC-03

export async function register(req, res) {
  const { name, email, mobile, password } = req.body;

  // FR-AUTH-03: say which field is taken so the form can point at it
  const [emailTaken, mobileTaken] = await Promise.all([User.exists({ email }), User.exists({ mobile })]);
  if (emailTaken) throw conflict('An account with this email already exists.', { field: 'email' });
  if (mobileTaken) throw conflict('An account with this mobile number already exists.', { field: 'mobile' });

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user = await User.create({ name, email, mobile, passwordHash });
  res.status(201).json({ token: signToken(user), user: selfUser(user) });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+email +mobile +passwordHash');
  const ok = user && !user.isBot && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw new AppError(401, 'invalid_credentials', 'Email or password is incorrect.');
  if (user.isBanned) {
    throw new AppError(403, 'banned', `This account is banned${user.banReason ? `: ${user.banReason}` : '.'}`);
  }
  res.json({ token: signToken(user), user: selfUser(user) });
}
