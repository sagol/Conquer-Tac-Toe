import io from 'socket.io-client';

const backendUrl = process.env.REACT_APP_BACKEND_URL;
console.log(`Socket initializing connection to: ${backendUrl}`);

const socket = io(backendUrl, {
  withCredentials: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

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
