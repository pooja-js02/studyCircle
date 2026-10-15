import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { userFromToken } from '../middleware/auth.js';
import { Membership } from '../models/index.js';
import { groupRoom, setIo, userRoom } from '../services/realtime.js';
import { registerChatHandlers } from './chatHandlers.js';

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigins, credentials: false },
    maxHttpBufferSize: 64 * 1024,
  });

  // NFR-SEC-01: every socket is authenticated before any event is handled
  io.use(async (socket, next) => {
    try {
      const user = await userFromToken(socket.handshake.auth?.token);
      socket.data.user = { id: String(user._id), name: user.name, avatarUrl: user.avatarUrl };
      next();
    } catch (err) {
      next(Object.assign(new Error(err.message || 'unauthorized'), { data: { code: err.code || 'unauthorized' } }));
    }
  });

  io.on('connection', async (socket) => {
    const { id } = socket.data.user;
    // SRS 4.3: join user:<id> and group:<id> for each membership
    socket.join(userRoom(id));
    const memberships = await Membership.find({ user: id }).select('group').lean();
    socket.join(memberships.map((m) => groupRoom(m.group)));
    registerChatHandlers(io, socket);
    socket.emit('ready');
  });

  setIo(io);
  return io;
}
