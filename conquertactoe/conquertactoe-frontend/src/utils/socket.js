import io from 'socket.io-client';

const backendUrl = process.env.REACT_APP_BACKEND_URL;
console.log(`Socket connecting to: ${backendUrl}`);

const socket = io(backendUrl, {
  withCredentials: true,
  extraHeaders: {
    "my-custom-header": "abcd"
  }
});

export default socket;
