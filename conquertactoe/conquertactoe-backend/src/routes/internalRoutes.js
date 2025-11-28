const express = require('express');
const router = express.Router();
const gameRequestController = require('../controllers/gameRequestController');

// Internal routes (protected by network/firewall or secret in production)
// For now, we assume this is only accessible internally or via Admin Dashboard

router.post('/games/:gameId/reset', gameRequestController.resetGame);

module.exports = router;
