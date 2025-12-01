import axios from 'axios';

const getBaseUrl = () => {
    const url = process.env.REACT_APP_ADMIN_API_URL || 'http://localhost:4000/admin';
    return url.endsWith('/admin') ? url : `${url}/admin`;
};

const api = axios.create({
    baseURL: getBaseUrl(),
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
