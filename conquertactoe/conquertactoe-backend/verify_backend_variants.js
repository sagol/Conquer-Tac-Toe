const axios = require('axios');

const BACKEND_URL = 'http://localhost:3000';
const USER_EMAIL = `test_${Date.now()}@example.com`;
const USER_PASSWORD = 'password123';

async function runTest() {
    try {
        console.log('--- Starting Backend Verification ---');

        // 1. Register/Login
        console.log('1. Logging in via Dev Login...');
        const authRes = await axios.post(`${BACKEND_URL}/auth/dev_login`, {
            username: `TestUser_${Date.now()}`
        });
        const cookie = authRes.headers['set-cookie'];
        console.log('   User registered and logged in.');

        const axiosConfig = {
            headers: { Cookie: cookie },
            withCredentials: true
        };

        // 2. Test Classic Tic-Tac-Toe (Variant 1)
        console.log('\n2. Testing Classic Tic-Tac-Toe (Variant 1)...');
        const classicGame = await axios.post(`${BACKEND_URL}/game-requests/bot`, { variantId: 1 }, axiosConfig);
        console.log(`   Game created: ID ${classicGame.data.id}, Board Size: ${classicGame.data.board.length}x${classicGame.data.board[0].length}`);

        if (classicGame.data.board.length !== 3) throw new Error('Classic board size should be 3x3');

        // Make a move
        console.log('   Making player move (0,0)...');
        const classicMove = await axios.put(`${BACKEND_URL}/game-requests/${classicGame.data.id}`, {
            board: classicGame.data.board, // Send current board
            activePlayer: 1,
            player1Cones: classicGame.data.player1_cones,
            player2Cones: classicGame.data.player2_cones,
            row: 0,
            col: 0,
            coneSize: 0 // Irrelevant for Classic but required by schema
        }, axiosConfig);

        console.log('   Move accepted. Checking for bot response...');
        // Wait a bit for bot
        await new Promise(r => setTimeout(r, 2000));

        const classicUpdate = await axios.get(`${BACKEND_URL}/game-requests/${classicGame.data.id}`, axiosConfig);
        const classicBoard = typeof classicUpdate.data.board === 'string' ? JSON.parse(classicUpdate.data.board) : classicUpdate.data.board;

        // Check if bot played (should be a 2 on the board)
        let botPlayedClassic = false;
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                if (classicBoard[r][c] && classicBoard[r][c].player === 2) botPlayedClassic = true;
            }
        }
        if (botPlayedClassic) console.log('   ✅ Bot made a move in Classic Tic-Tac-Toe');
        else console.error('   ❌ Bot did NOT make a move in Classic Tic-Tac-Toe');


        // 3. Test Gomoku (Variant 2)
        console.log('\n3. Testing Gomoku (Variant 2)...');
        const gomokuGame = await axios.post(`${BACKEND_URL}/game-requests/bot`, { variantId: 2 }, axiosConfig);
        console.log(`   Game created: ID ${gomokuGame.data.id}, Board Size: ${gomokuGame.data.board.length}x${gomokuGame.data.board[0].length}`);

        if (gomokuGame.data.board.length !== 15) throw new Error('Gomoku board size should be 15x15');

        // Make a move
        console.log('   Making player move (7,7)...');
        const gomokuMove = await axios.put(`${BACKEND_URL}/game-requests/${gomokuGame.data.id}`, {
            board: gomokuGame.data.board,
            activePlayer: 1,
            player1Cones: gomokuGame.data.player1_cones,
            player2Cones: gomokuGame.data.player2_cones,
            row: 7,
            col: 7,
            coneSize: 0
        }, axiosConfig);

        console.log('   Move accepted. Checking for bot response...');
        await new Promise(r => setTimeout(r, 2000));

        const gomokuUpdate = await axios.get(`${BACKEND_URL}/game-requests/${gomokuGame.data.id}`, axiosConfig);
        const gomokuBoard = typeof gomokuUpdate.data.board === 'string' ? JSON.parse(gomokuUpdate.data.board) : gomokuUpdate.data.board;

        let botPlayedGomoku = false;
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                if (gomokuBoard[r][c] && gomokuBoard[r][c].player === 2) botPlayedGomoku = true;
            }
        }
        if (botPlayedGomoku) console.log('   ✅ Bot made a move in Gomoku');
        else console.error('   ❌ Bot did NOT make a move in Gomoku');


        // 4. Test Conquer Classic (Variant 3)
        console.log('\n4. Testing Conquer Classic (Variant 3)...');
        const conquerGame = await axios.post(`${BACKEND_URL}/game-requests/bot`, { variantId: 3 }, axiosConfig);
        console.log(`   Game created: ID ${conquerGame.data.id}, Board Size: ${conquerGame.data.board.length}x${conquerGame.data.board[0].length}`);

        // Make a move
        console.log('   Making player move (1,1) with Small Cone...');
        const conquerMove = await axios.put(`${BACKEND_URL}/game-requests/${conquerGame.data.id}`, {
            board: conquerGame.data.board,
            activePlayer: 1,
            player1Cones: conquerGame.data.player1_cones,
            player2Cones: conquerGame.data.player2_cones,
            row: 1,
            col: 1,
            coneSize: 0 // Small cone
        }, axiosConfig);

        console.log('   Move accepted. Checking for bot response...');
        await new Promise(r => setTimeout(r, 2000));

        const conquerUpdate = await axios.get(`${BACKEND_URL}/game-requests/${conquerGame.data.id}`, axiosConfig);
        const conquerBoard = typeof conquerUpdate.data.board === 'string' ? JSON.parse(conquerUpdate.data.board) : conquerUpdate.data.board;

        let botPlayedConquer = false;
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                if (conquerBoard[r][c] && conquerBoard[r][c].player === 2) botPlayedConquer = true;
            }
        }
        if (botPlayedConquer) console.log('   ✅ Bot made a move in Conquer Classic');
        else console.error('   ❌ Bot did NOT make a move in Conquer Classic');

        console.log('\n--- Verification Complete ---');

    } catch (error) {
        console.error('Test Failed:', error.response ? error.response.data : error.message);
    }
}

runTest();
