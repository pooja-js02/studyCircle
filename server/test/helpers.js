import http from 'node:http';
import mongoose from 'mongoose';
import request from 'supertest';
import { io as ioClient } from 'socket.io-client';

process.env.MONGO_URL ||= 'mongodb://localhost:27017/studycircle_test';
process.env.JWT_SECRET ||= 'test-secret';
process.env.AUTH_RATE_LIMIT = '1000';
process.env.UPLOAD_DIR ||= '/tmp/studycircle-test-uploads';
// Tests store files on local disk, never in the real Cloudinary account from server/.env
process.env.CLOUDINARY_URL = '';

const { connectDb } = await import('../src/config/db.js');
const { createApp } = await import('../src/app.js');
const { createSocketServer } = await import('../src/sockets/index.js');

export async function startServer() {
  await connectDb(process.env.MONGO_URL);
  await mongoose.connection.db.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  const app = createApp();
  const server = http.createServer(app);
  const io = createSocketServer(server);
  await new Promise((resolve) => server.listen(0, resolve));
  const url = `http://localhost:${server.address().port}`;
  return {
    app,
    url,
    api: () => request(app),
    async stop() {
      openSockets.forEach((s) => s.close());
      io.close();
      await new Promise((resolve) => server.close(resolve));
      await mongoose.disconnect();
    },
  };
}

let counter = 0;
export async function registerUser(api, name = 'Test User') {
  counter += 1;
  const n = String(counter).padStart(4, '0');
  const body = { name, email: `user${n}.${Date.now()}@gmail.com`, mobile: `98765${n}${counter % 10}`, password: 'password123' };
  const res = await api().post('/api/auth/register').send(body).expect(201);
  return { ...res.body.user, token: res.body.token, password: body.password };
}

export const authed = (api, user) => ({
  get: (p) => api().get(p).set('Authorization', `Bearer ${user.token}`),
  post: (p) => api().post(p).set('Authorization', `Bearer ${user.token}`),
  patch: (p) => api().patch(p).set('Authorization', `Bearer ${user.token}`),
  delete: (p) => api().delete(p).set('Authorization', `Bearer ${user.token}`),
});

const openSockets = new Set();

export function connectSocket(url, user) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(url, { auth: { token: user.token }, transports: ['websocket'], forceNew: true, reconnection: false });
    openSockets.add(socket);
    socket.once('ready', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

export const waitFor = (socket, event, ms = 2000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    socket.once(event, (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
  });

// Walks any JSON payload and fails if a private field of someone else shows up (NFR-PRIV-02)
export function findLeaks(payload, forbiddenValues) {
  const text = JSON.stringify(payload);
  return forbiddenValues.filter((v) => v && text.includes(v));
}
