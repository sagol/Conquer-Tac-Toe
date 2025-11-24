const { checkGameOverCondition } = require('./gameUtils');

const testDiagonalWin = () => {
    const board = [
        [{ player: 2, size: 2 }, { player: 1, size: 1 }, null],
        [{ player: 1, size: 1 }, { player: 2, size: 2 }, null],
        [null, { player: 1, size: 1 }, { player: 2, size: 2 }]
    ];
    const p1Cones = [0, 0, 0];
    const p2Cones = [0, 0, 0];

    const result = checkGameOverCondition(board, p1Cones, p2Cones);
    console.log('Diagonal Win Test Result:', result);
    if (result && result.winner === 2) {
        console.log('PASS');
    } else {
        console.log('FAIL');
    }
};

testDiagonalWin();
