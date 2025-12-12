const express = require('express');
const router = express.Router();
const gameRequestController = require('../controllers/gameRequestController');
const { ensureAuthenticated } = require('../middleware/auth');
const { getPendingRematch, acceptRematchHttp } = require('../socket');

router.post('/game-requests', ensureAuthenticated, gameRequestController.createGameRequest);
router.post('/game-requests/bot', ensureAuthenticated, gameRequestController.createBotGameRequest);
router.get('/game-requests', ensureAuthenticated, gameRequestController.getActiveGameRequests);
router.post('/game-requests/:requestId/join', ensureAuthenticated, gameRequestController.joinGameRequest);
router.delete('/game-requests/:requestId', ensureAuthenticated, gameRequestController.cancelGameRequest);
router.get('/game-requests/:requestId', ensureAuthenticated, gameRequestController.getGameRequestById);
router.put('/game-requests/:gameId', ensureAuthenticated, gameRequestController.updateGameRequest);
router.post('/game-requests/:gameId/surrender', ensureAuthenticated, gameRequestController.surrenderGame);
router.post('/game-requests/:gameId/timeout', ensureAuthenticated, gameRequestController.claimTimeout);

// Check for pending rematch request
router.get('/game-requests/:gameId/pending-rematch', ensureAuthenticated, (req, res) => {
    const gameId = parseInt(req.params.gameId);
    const userId = req.user.user_id;

    const pendingRematch = getPendingRematch(gameId, userId);

    if (pendingRematch) {
        res.json({ hasPendingRematch: true, ...pendingRematch });
    } else {
        res.json({ hasPendingRematch: false });
    }
});

// Accept a pending rematch request via HTTP (bypasses socket auth issues)
router.post('/game-requests/:gameId/accept-rematch', ensureAuthenticated, async (req, res) => {
    const gameId = parseInt(req.params.gameId);
    const userId = req.user.user_id;

    try {
        const result = await acceptRematchHttp(gameId, userId);

        if (result.success) {
            if (result.newGameId) {
                res.json({ success: true, newGameId: result.newGameId });
            } else if (result.waiting) {
                res.json({ success: true, waiting: true, message: 'Waiting for other player' });
            }
        } else {
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('[Rematch HTTP] Error accepting rematch:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

module.exports = router;
