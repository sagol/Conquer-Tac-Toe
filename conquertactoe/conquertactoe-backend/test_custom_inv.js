const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testCustomInventory() {
    console.log('=== Testing Custom Inventory ===');

    // Login
    const loginRes = await axios.post(`${BASE_URL}/auth/dev_login`, { username: 'CustomInvTest' });
    const cookie = loginRes.headers['set-cookie'];
    console.log('✅ Logged in');

    // Create game with custom cones
    const payload = {
        gameType: 'bot',
        variantId: 5,
        customCones: {
            small: 5,
            medium: 0,
            large: 1
        }
    };

    console.log('Sending payload:', JSON.stringify(payload, null, 2));

    const gameRes = await axios.post(`${BASE_URL}/game-requests/bot`, payload, {
        headers: { Cookie: cookie }
    });

    console.log('Game created:', gameRes.data.id);
    console.log('Player 1 cones:', gameRes.data.player1_cones);
    console.log('Player 2 cones:', gameRes.data.player2_cones);

    // Verify
    if (JSON.stringify(gameRes.data.player1_cones) === JSON.stringify([5, 0, 1])) {
        console.log('✅ PASS: Custom inventory applied correctly!');
    } else {
        console.log('❌ FAIL: Expected [5,0,1], got', gameRes.data.player1_cones);
    }
}

testCustomInventory().catch(err => {
    console.error('Error:', err.message);
    if (err.response) console.error('Response:', err.response.data);
});
