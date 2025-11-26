const axios = require('axios');

async function testBoardSizes() {
    console.log('=== Testing Gomoku Board Size Selection ===\n');

    const BASE_URL = 'http://localhost:3000';

    // Login
    const loginRes = await axios.post(`${BASE_URL}/auth/dev_login`, { username: 'BoardSizeTest' });
    const cookie = loginRes.headers['set-cookie'];
    console.log('✅ Logged in\n');

    const sizes = [10, 13, 15, 19];

    for (const size of sizes) {
        console.log(`Testing ${size}x${size} board...`);

        const payload = {
            gameType: 'bot',
            variantId: 2, // Gomoku
            boardSize: size
        };

        const gameRes = await axios.post(`${BASE_URL}/game-requests/bot`, payload, {
            headers: { Cookie: cookie }
        });

        const actualSize = gameRes.data.board.length;

        if (actualSize === size) {
            console.log(`✅ PASS: Board is ${actualSize}x${actualSize}\n`);
        } else {
            console.log(`❌ FAIL: Expected ${size}x${size}, got ${actualSize}x${actualSize}\n`);
        }
    }
}

testBoardSizes().catch(err => {
    console.error('Error:', err.message);
    if (err.response) console.error('Response:', err.response.data);
});
