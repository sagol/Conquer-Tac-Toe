import io from 'socket.io-client';

const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
console.log(`Socket initializing connection to: ${backendUrl}`);

// Determine correct socket path based on backend URL
// If backend is at https://domain.com/api, socket should likely be at /api/socket.io
let socketUrl = backendUrl;
let socketOptions = {
  withCredentials: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
};

try {
  const urlObj = new URL(backendUrl);
  // If there is a pathname other than '/', append /socket.io to it
  if (urlObj.pathname && urlObj.pathname !== '/') {
    // e.g. /api -> /api/socket.io
    const cleanPath = urlObj.pathname.replace(/\/+$/, ''); // remove trailing slash
    socketOptions.path = `${cleanPath}/socket.io`;
    // Socket.io client expects the URL to be just the origin if we are specifying a custom path that is NOT the default
    // But passing the full URL is usually safer, let's just keep backendUrl but set the path explicitly
  }
} catch (e) {
  console.error("Invalid Backend URL for socket setup:", backendUrl);
}

const socket = io(backendUrl, socketOptions);

// Connection event handlers for debugging
socket.on('connect', () => {
  console.log(`[Socket] Connected with ID: ${socket.id}`);
});

socket.on('disconnect', (reason) => {
  console.log(`[Socket] Disconnected: ${reason}`);
});

socket.on('connect_error', (error) => {
  console.error('[Socket] Connection error:', error.message);
});

socket.on('reconnect', (attemptNumber) => {
  console.log(`[Socket] Reconnected after ${attemptNumber} attempts`);
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log(`[Socket] Reconnection attempt ${attemptNumber}`);
});

export default socket;
