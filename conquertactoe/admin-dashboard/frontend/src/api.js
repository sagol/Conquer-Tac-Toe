import axios from 'axios';

const api = axios.create({
    baseURL: process.env.REACT_APP_ADMIN_API_URL || 'http://localhost:4000/admin',
});

export default api;
