const { Server } = require('socket.io');

let io;

function init(server, sessionMiddleware) {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Convert express middleware to socket.io middleware
  const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);

  if (sessionMiddleware) {
    io.use(wrap(sessionMiddleware));
    const passport = require('passport');
    io.use(wrap(passport.initialize()));
    io.use(wrap(passport.session()));
  }

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Log authenticated user if present
    const user = socket.request.user;
    if (user) {
      console.log(`Socket ${socket.id} authenticated as user ${user.username} (${user.user_id})`);
    }

    // Join user-specific room for private notifications
    socket.on('joinUserRoom', (userId) => {
      // Validate userId is a valid number
      if (
        userId !== undefined &&
        (
          (typeof userId === 'number' && Number.isInteger(userId)) ||
          (typeof userId === 'string' && userId.trim() !== '' && !isNaN(Number(userId)) && Number.isInteger(Number(userId)))
        )
      ) {
        const targetUserId = parseInt(userId, 10);
        const authenticatedUser = socket.request.user;

        // Security Check: Ensure the connected socket belongs to the user they are trying to join
        if (authenticatedUser && parseInt(authenticatedUser.user_id, 10) === targetUserId) {
          const roomName = `user_${targetUserId}`;
          socket.join(roomName);
          console.log(`Socket ${socket.id} joined room ${roomName} (Authorized)`);
        } else {
          console.warn(`Unauthorized joinUserRoom attempt. Socket User: ${authenticatedUser?.user_id || 'Unauthenticated'}, Target: ${targetUserId}`);
          socket.emit('error', { message: 'Unauthorized to join this notification room.' });
        }
      } else {
        console.warn(`Invalid userId for joinUserRoom: ${userId} (type: ${typeof userId})`);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  return io;
}

function getIo() {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
}

module.exports = { init, getIo };
