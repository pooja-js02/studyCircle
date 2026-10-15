import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const limited = (message) => (_req, res) =>
  res.status(429).json({ error: { code: 'rate_limited', message } });

// NFR-SEC-04: login and register are limited to 10 attempts per 15 minutes per IP.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.authRateLimit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: limited('Too many attempts. Please wait 15 minutes and try again.'),
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: limited('You are going a bit fast. Please slow down.'),
});
