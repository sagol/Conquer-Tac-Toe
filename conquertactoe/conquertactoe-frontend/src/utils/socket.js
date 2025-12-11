import io from 'socket.io-client';

const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
console.log(`Socket initializing connection to: ${backendUrl}`);

// Determine correct socket path based on backend URL
let socketOptions = {
  withCredentials: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
};

let connectionUrl = backendUrl;

try {
  const urlObj = new URL(backendUrl);
  // If there is a pathname other than '/', append /socket.io to it
  if (urlObj.pathname && urlObj.pathname !== '/') {
    // e.g. /api -> /api/socket.io
    const cleanPath = urlObj.pathname.replace(/\/+$/, ''); // remove trailing slash
    socketOptions.path = `${cleanPath}/socket.io`;

    // Use only the origin for the connection URL when using a custom path
    connectionUrl = urlObj.origin;
  }
} catch (e) {
  console.error("Invalid Backend URL for socket setup:", backendUrl);
}

const socket = io(connectionUrl, socketOptions);

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
