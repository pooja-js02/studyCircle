import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDb(url = env.mongoUrl) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(url);
  // Build declared indexes (unique email/mobile, partial join-request index, text indexes)
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  return mongoose.connection;
}
