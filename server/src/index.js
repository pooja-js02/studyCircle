import http from 'node:http';
import './models/index.js';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDb } from './config/db.js';
import { createSocketServer } from './sockets/index.js';

if (env.isProd && !env.cloudinaryUrl) {
  console.warn('CLOUDINARY_URL is not set: uploads go to local disk, which most hosts wipe on every deploy.');
}

await connectDb();
const app = createApp();
const server = http.createServer(app);
const io = createSocketServer(server);

server.listen(env.port, () => {
  console.log(`StudyCircle API listening on :${env.port} (${env.nodeEnv})`);
});

// Live sockets never close by themselves, so close them first and don't wait forever
const shutdown = () => {
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
