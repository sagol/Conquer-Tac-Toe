const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:4000';

describe('Game Creation Enforcement', () => {
    let adminToken;
    let userCookie;

    beforeAll(async () => {
        // Login as admin
        const loginRes = await axios.post(`${ADMIN_URL}/admin/auth/login`, {
            email: 'admin@conquertactoe.com',
            password: 'admin123'
        });
        adminToken = loginRes.data.token;

        // Login as regular user to get session
        const userRes = await axios.post(`${BACKEND_URL}/auth/dev-login`, {
            username: 'Player1'
        });
        userCookie = userRes.headers['set-cookie'];
    });

    afterAll(async () => {
        // Re-enable game creation
        await axios.put(
            `${ADMIN_URL}/admin/settings/game_creation`,
            { value: 'true' },
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );
    });

    test('should block game creation when disabled', async () => {
        // Disable game creation
        await axios.put(
            `${ADMIN_URL}/admin/settings/game_creation`,
            { value: 'false' },
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );

        // Wait for cache
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Try to create a game
        try {
            await axios.post(
                `${BACKEND_URL}/api/game-requests`,
                { gameType: 'player', variantId: 3 },
                { headers: { Cookie: userCookie } }
            );
            throw new Error('Should have returned 403');
        } catch (error) {
            expect(error.response.status).toBe(403);
            expect(error.response.data.error).toContain('disabled');
        }
    });

    test('should allow game creation when enabled', async () => {
        // Enable game creation
        await axios.put(
            `${ADMIN_URL}/admin/settings/game_creation`,
            { value: 'true' },
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );

        // Wait for cache
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Create a game
        const res = await axios.post(
            `${BACKEND_URL}/api/game-requests`,
            { gameType: 'player', variantId: 3 },
            { headers: { Cookie: userCookie } }
        );

        expect(res.status).toBe(201);
        expect(res.data).toHaveProperty('id');

        // Clean up - delete the created game
        if (res.data.id) {
            await axios.delete(
                `${BACKEND_URL}/api/game-requests/${res.data.id}`,
                { headers: { Cookie: userCookie } }
            ).catch(() => { });
        }
    });
});
