const axios = require('axios');

const BASE_URL = 'http://localhost:3000'; // Backend URL
const USERNAME = 'WinApiTester';

async function runTest() {
    try {
        console.log('1. Logging in...');
        const loginRes = await axios.post(`${BASE_URL}/auth/dev_login`, { username: USERNAME });
        const cookie = loginRes.headers['set-cookie'];
        const userId = loginRes.data.user.user_id;
        console.log('Logged in as:', USERNAME, 'ID:', userId);

        console.log('2. Creating Bot Game...');
        const createRes = await axios.post(`${BASE_URL}/game-requests`, { gameType: 'bot' }, {
            headers: { Cookie: cookie }
        });
        const gameId = createRes.data.id;
        console.log('Game created. ID:', gameId);

        // Helper to make a move
        const makeMove = async (row, col, coneSize) => {
            console.log(`Making move: (${row}, ${col}) size ${coneSize}`);
            // Fetch current game state to get cones
            const gameRes = await axios.get(`${BASE_URL}/game-requests/${gameId}`, { headers: { Cookie: cookie } });
            const game = gameRes.data;

            const payload = {
                gameId: gameId,
                board: game.board,
                activePlayer: 1,
                player1Cones: game.player1_cones,
                player2Cones: game.player2_cones,
                row, col, coneSize
            };

            const moveRes = await axios.put(`${BASE_URL}/game-requests/${gameId}`, payload, {
                headers: { Cookie: cookie }
            });
            return moveRes.data;
        };

        console.log('3. Playing moves to let bot win...');

        // Move 1: (0,0) Medium
        let state = await makeMove(0, 0, 1);
        console.log('Move 1 Result Status:', state.status);

        // Wait for bot
        await new Promise(r => setTimeout(r, 2000));

        // Move 2: (1,0) Medium
        state = await makeMove(1, 0, 1);
        console.log('Move 2 Result Status:', state.status);

        // Wait for bot
        await new Promise(r => setTimeout(r, 2000));

        // Move 3: (2,0) Medium
        state = await makeMove(2, 0, 1);
        console.log('Move 3 Result Status:', state.status);
        console.log('Move 3 Result Winner:', state.winner);

        if (state.status === 'won' && state.winner === 2) {
            console.log('SUCCESS: Bot won and winner is 2!');
        } else {
            console.log('FAILURE: Game not won or winner incorrect.');
            console.log('Final State:', JSON.stringify(state, null, 2));
        }

    } catch (error) {
        console.error('Test Failed:', error.message);
        if (error.response) {
            console.error('Response Data:', error.response.data);
        }
    }
}

runTest();
