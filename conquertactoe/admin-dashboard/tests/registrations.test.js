const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:4000';

describe('New Registrations Enforcement', () => {
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
        // Re-enable registrations
        await axios.put(
            `${ADMIN_URL}/admin/settings/new_registrations`,
            { value: 'true' },
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );
    });

    test('should block new user registration when disabled', async () => {
        // Disable new registrations
        await axios.put(
            `${ADMIN_URL}/admin/settings/new_registrations`,
            { value: 'false' },
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );

        // Wait for cache
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Try to register new user via dev login
        const newUsername = `testuser_${Date.now()}`;
        try {
            await axios.post(`${BACKEND_URL}/auth/dev-login`, {
                username: newUsername
            });
            fail('Should have returned 403');
        } catch (error) {
            expect(error.response.status).toBe(403);
            expect(error.response.data.error).toContain('disabled');
        }
    });

    test('should allow existing users to login when registrations disabled', async () => {
        // Registrations still disabled from previous test

        // Existing user should be able to login
        const res = await axios.post(`${BACKEND_URL}/auth/dev-login`, {
            username: 'Player1'  // Assuming this user exists
        });

        expect(res.status).toBe(200);
        expect(res.data).toHaveProperty('username');
    });

    test('should allow new registrations when enabled', async () => {
        // Enable registrations
        await axios.put(
            `${ADMIN_URL}/admin/settings/new_registrations`,
            { value: 'true' },
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );

        // Wait for cache
        await new Promise(resolve => setTimeout(resolve, 1000));

        // New user should be able to register
        const newUsername = `testuser_${Date.now()}`;
        const res = await axios.post(`${BACKEND_URL}/auth/dev-login`, {
            username: newUsername
        });

        expect(res.status).toBe(200);
        expect(res.data.username).toBe(newUsername);
    });
});
