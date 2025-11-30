const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:4000';

describe('Dev Login Setting Enforcement', () => {
    let adminToken;

    beforeAll(async () => {
        // Login as admin
        const loginRes = await axios.post(`${ADMIN_URL}/admin/auth/login`, {
            email: 'admin@conquertactoe.com',
            password: 'admin123'
        });
        adminToken = loginRes.data.token;
    });

    afterAll(async () => {
        // Re-enable dev login
        await axios.put(
            `${ADMIN_URL}/admin/settings/ENABLE_DEV_LOGIN`,
            { value: 'true' },
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );
    });

    test('should return false in public config when disabled', async () => {
        // Disable dev login
        await axios.put(
            `${ADMIN_URL}/admin/settings/ENABLE_DEV_LOGIN`,
            { value: 'false' },
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );

        // Fetch public config
        const res = await axios.get(`${BACKEND_URL}/api/config/public`);

        expect(res.status).toBe(200);
        expect(res.data.ENABLE_DEV_LOGIN).toBe('false');
    });

    test('should return true in public config when enabled', async () => {
        // Enable dev login
        await axios.put(
            `${ADMIN_URL}/admin/settings/ENABLE_DEV_LOGIN`,
            { value: 'true' },
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );

        // Fetch public config
        const res = await axios.get(`${BACKEND_URL}/api/config/public`);

        expect(res.status).toBe(200);
        expect(res.data.ENABLE_DEV_LOGIN).toBe('true');
    });

    test('should be accessible without authentication', async () => {
        // Public config should not require auth
        const res = await axios.get(`${BACKEND_URL}/api/config/public`);

        expect(res.status).toBe(200);
        expect(res.data).toHaveProperty('ENABLE_DEV_LOGIN');
    });
});
