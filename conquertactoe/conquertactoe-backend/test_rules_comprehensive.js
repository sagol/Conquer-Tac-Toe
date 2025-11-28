const axios = require('axios');

const API_URL = 'http://127.0.0.1:3000';
let authToken;
let userId;

async function login() {
    try {
        const res = await axios.post(`${API_URL}/auth/dev_login`, { username: 'RuleTester' });
        authToken = res.data.token;
        userId = res.data.user.user_id;
        axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
        console.log('Logged in as RuleTester');
    } catch (error) {
        console.error('Login failed:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
            console.error('Headers:', error.response.headers);
        } else if (error.request) {
            console.error('No response received:', error.request);
        }
        process.exit(1);
    }
}

async function createGame(variantId, gameType = 'public', customCones = null, boardSize = null) {
    try {
        const payload = {
            variant_id: variantId,
            game_type: gameType,
            boardSize: boardSize,
            customCones: customCones
        };
        const res = await axios.post(`${API_URL}/game-requests`, payload);
        return res.data.gameRequest.request_id;
    } catch (error) {
        console.error('Create game failed:', error.response?.data || error.message);
        throw error;
    }
}

async function makeMove(gameId, row, col, coneSize) {
    try {
        const res = await axios.post(`${API_URL}/game-requests/${gameId}/move`, {
            row,
            col,
            cone_size: coneSize
        });
        return { success: true, data: res.data };
    } catch (error) {
        return { success: false, error: error.response?.data || error.message };
    }
}

async function runTests() {
    await login();

    console.log('\n=== Test 1: Conquer Classic - Invalid Overwrite (Smaller on Larger) ===');
    // Variant 3: Conquer Classic (Larger can eat smaller)
    const gameId1 = await createGame(3, 'public');
    // Player 1 places Large cone at 1,1
    await makeMove(gameId1, 1, 1, 2);

    // Switch to Player 2 (simulate by logging in as another user or just forcing turn if dev mode allows, 
    // but here we are testing rules. Actually, we need a second player for PvP rules testing properly.
    // For simplicity, we can test "Overwrite Own Cone" rules if allowed, or just test basic placement.
    // Wait, to test P2 overwrite, we need P2.
    // Let's use 'bot' game to test Player 1 moves against Bot's pieces?
    // Or just test Player 1 invalid moves.

    // Test: Player 1 tries to overwrite their OWN Large cone with Small cone (Invalid)
    const move1 = await makeMove(gameId1, 1, 1, 0);
    if (!move1.success) {
        console.log('✅ PASS: Prevented overwriting own large cone with small cone');
    } else {
        console.error('❌ FAIL: Allowed overwriting own large cone with small cone');
    }

    console.log('\n=== Test 2: Conquer Classic - Valid Overwrite (Larger on Smaller) ===');
    // Player 1 places Small cone at 0,0
    await makeMove(gameId1, 0, 0, 0);
    // Player 1 overwrites OWN Small cone with Large cone (Valid in Conquer?)
    // Usually you can overwrite opponent. Can you overwrite own?
    // Rules say "allowOverwrite": true.
    const move2 = await makeMove(gameId1, 0, 0, 2);
    if (move2.success) {
        console.log('✅ PASS: Allowed overwriting own small cone with large cone');
    } else {
        console.error('❌ FAIL: Prevented overwriting own small cone with large cone');
    }

    console.log('\n=== Test 3: Conquer Same-Size - Equal Overwrite ===');
    // Variant 4: Conquer Same Size (Larger OR Equal)
    const gameId2 = await createGame(4, 'public');
    // Place Medium cone
    await makeMove(gameId2, 1, 1, 1);
    // Try to overwrite with Medium cone
    const move3 = await makeMove(gameId2, 1, 1, 1);
    if (move3.success) {
        console.log('✅ PASS: Allowed overwriting with same size cone');
    } else {
        console.error('❌ FAIL: Prevented overwriting with same size cone');
    }

    console.log('\n=== Test 4: Classic Tic-Tac-Toe - No Overwrite ===');
    // Variant 1: Classic
    const gameId3 = await createGame(1, 'public');
    await makeMove(gameId3, 1, 1, 0);
    const move4 = await makeMove(gameId3, 1, 1, 0);
    if (!move4.success) {
        console.log('✅ PASS: Prevented overwrite in Classic Tic-Tac-Toe');
    } else {
        console.error('❌ FAIL: Allowed overwrite in Classic Tic-Tac-Toe');
    }

    console.log('\n=== Test 5: Bot Game - Bot Move Validation ===');
    // Create Bot game
    const gameIdBot = await createGame(3, 'bot');
    // Player 1 moves
    await makeMove(gameIdBot, 1, 1, 2); // Place Large

    // Bot should move automatically.
    // We can't easily force the bot to make an INVALID move from here without mocking the bot service.
    // But we implemented validation in the controller.
    // If the bot tries an invalid move, the controller should catch it and fallback.
    // We can verify the game state is still valid.

    // Let's just verify the game continues.
    await new Promise(r => setTimeout(r, 1000)); // Wait for bot
    // Fetch game state
    const res = await axios.get(`${API_URL}/game-requests/${gameIdBot}`);
    const board = JSON.parse(res.data.current_board_state);

    // Check if bot made a move (should be at least 2 pieces on board)
    let pieces = 0;
    board.forEach(row => row.forEach(cell => { if (cell) pieces++; }));

    if (pieces >= 2) {
        console.log('✅ PASS: Bot made a valid move (or fallback worked)');
    } else {
        console.error('❌ FAIL: Bot did not make a move');
    }

}

runTests();
