const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:4000';

describe('Maintenance Mode Enforcement', () => {
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
        // Ensure maintenance mode is disabled after tests
        await axios.put(
            `${ADMIN_URL}/admin/settings/maintenance_mode`,
            { value: 'false' },
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );
    });

    test('should block main site when maintenance mode is enabled', async () => {
        // Enable maintenance mode
        await axios.put(
            `${ADMIN_URL}/admin/settings/maintenance_mode`,
            { value: 'true' },
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );

        // Wait for cache to update (30 seconds max)
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Try to access main site
        let error;
        try {
            await axios.get(`${BACKEND_URL}/game-requests`);
        } catch (e) {
            error = e;
        }

        if (!error) {
            throw new Error('Should have returned 503');
        }

        const result = {
            status: error.response?.status,
            errorMsg: error.response?.data?.error
        };

        expect(result.status).toBe(503);
        expect(result.errorMsg).toContain('maintenance');
    });

    test('should allow admin endpoints when maintenance mode is enabled', async () => {
        // Maintenance mode already enabled from previous test

        // Admin endpoints should still work
        const res = await axios.get(
            `${ADMIN_URL}/admin/settings`,
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );

        expect(res.status).toBe(200);
        expect(res.data).toHaveProperty('maintenance_mode');
    });

    test('should allow access when maintenance mode is disabled', async () => {
        // Disable maintenance mode
        await axios.put(
            `${ADMIN_URL}/admin/settings/maintenance_mode`,
            { value: 'false' },
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );

        // Wait for cache to update
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Main site should work
        const res = await axios.get(`${BACKEND_URL}/api/config/public`);
        expect(res.status).toBe(200);
    });
});
