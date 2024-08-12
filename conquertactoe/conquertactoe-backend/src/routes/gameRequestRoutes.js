const express = require('express');
const router = express.Router();
const gameRequestController = require('../controllers/gameRequestController');
const { ensureAuthenticated } = require('../middleware/auth');

router.post('/game-requests', ensureAuthenticated, gameRequestController.createGameRequest);
router.get('/game-requests', ensureAuthenticated, gameRequestController.getActiveGameRequests);
router.post('/game-requests/:requestId/join', ensureAuthenticated, gameRequestController.joinGameRequest);
router.delete('/game-requests/:requestId', ensureAuthenticated, gameRequestController.cancelGameRequest);
router.get('/game-requests/:requestId', ensureAuthenticated, gameRequestController.getGameRequestById);
router.put('/game-requests/:gameId', ensureAuthenticated, gameRequestController.updateGameRequest);
router.post('/game-requests/:gameId/surrender', ensureAuthenticated, gameRequestController.surrenderGame);

module.exports = router;
