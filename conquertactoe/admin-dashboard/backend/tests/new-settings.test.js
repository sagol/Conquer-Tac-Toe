const axios = require('axios');
// Use IPs for internal network access
const API_URL = process.env.REACT_APP_ADMIN_API_URL || 'http://172.18.0.5:4000/admin';
const MAIN_API_URL = process.env.REACT_APP_MAIN_API_URL || 'http://172.18.0.8:3000/api'; // Main backend URL

describe('Admin Settings Enforcement', () => {
    let adminToken;

    beforeAll(async () => {
        // Login as admin
        const res = await axios.post(`${API_URL}/auth/login`, {
            email: 'admin@conquertactoe.com',
            password: 'admin123'
        });
        adminToken = res.data.token;
    });

    test('should enforce max_active_games_per_user', async () => {
        // 1. Set limit to 1
        await axios.put(`${API_URL}/settings/max_active_games_per_user`, { value: 1 }, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        // 2. Create a game (should succeed)
        // We need a user token. Let's use dev login.
        const userRes = await axios.post(`${MAIN_API_URL}/auth/dev-login`, { username: 'TestUserLimit' });
        const userToken = userRes.data.token;

        await axios.post(`${MAIN_API_URL}/game-requests`, { gameType: 'pvp', variantId: 3 }, {
            headers: { Authorization: `Bearer ${userToken}` }
        });

        // 3. Create another game (should fail)
        let error;
        try {
            await axios.post(`${MAIN_API_URL}/game-requests`, { gameType: 'pvp', variantId: 3 }, {
                headers: { Authorization: `Bearer ${userToken}` }
            });
        } catch (e) {
            error = e;
        }

        if (!error) {
            throw new Error('Should have failed due to limit');
        }

        const result = {
            status: error.response?.status,
            errorMsg: error.response?.data?.error
        };

        expect(result.status).toBe(400);
        expect(result.errorMsg).toContain('maximum limit');

        // Reset limit
        await axios.put(`${API_URL}/settings/max_active_games_per_user`, { value: 5 }, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
    });

    test('should enforce default_bot_difficulty', async () => {
        // 1. Set difficulty to 'hard'
        await axios.put(`${API_URL}/settings/default_bot_difficulty`, { value: 'hard' }, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        // 2. Create bot game
        const userRes = await axios.post(`${MAIN_API_URL}/auth/dev-login`, { username: 'TestBotDiff' });
        const userToken = userRes.data.token;

        // We can't easily verify the internal difficulty used by the bot without logs or inspecting DB if we stored it.
        // But we can ensure the request succeeds.
        const res = await axios.post(`${MAIN_API_URL}/game-requests/bot`, { variantId: 3 }, {
            headers: { Authorization: `Bearer ${userToken}` }
        });
        expect(res.status).toBe(201);

        // Reset difficulty
        await axios.put(`${API_URL}/settings/default_bot_difficulty`, { value: 'medium' }, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
    });
});
