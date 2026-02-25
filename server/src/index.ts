import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';

import app from './app';
import { connectDatabase } from './config/db';
import { env } from './config/env';
import { verifyAccessToken } from './services/tokenService';
import {
  getAttendanceRoomName,
  registerAttendanceRealtimeHooks,
  setAttendanceSocketServer
} from './services/attendance/realtimeService';

const bootstrap = async (): Promise<void> => {
  await connectDatabase();

  const httpServer = createServer(app);
  const io = new SocketServer(httpServer, {
    cors: {
      origin: true,
      credentials: true
    }
  });

  io.use((socket, next) => {
    try {
      const authHeader = socket.handshake.headers.authorization;
      const authToken = socket.handshake.auth?.token as string | undefined;
      const token =
        authToken ??
        (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
          ? authHeader.replace('Bearer ', '').trim()
          : '');

      if (!token) {
        next(new Error('Unauthorized socket token'));
        return;
      }

      const payload = verifyAccessToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Invalid socket token'));
    }
  });

  io.on('connection', (socket) => {
    const payload = socket.data.user as { organizationId: string; email: string } | undefined;
    if (payload?.organizationId) {
      socket.join(getAttendanceRoomName(payload.organizationId));
    }

    socket.emit('attendance:connected', {
      success: true,
      joinedAt: new Date().toISOString()
    });
  });

  setAttendanceSocketServer(io);
  registerAttendanceRealtimeHooks();

  httpServer.listen(env.port, () => {
    console.log(`[server] listening on port ${env.port}`);
  });
};

bootstrap().catch((error: unknown) => {
  console.error('[server] startup failed', error);
  process.exit(1);
});
