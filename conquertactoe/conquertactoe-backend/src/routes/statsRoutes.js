const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');

// Get global statistics
router.get('/stats/global', statsController.getGlobalStats);

module.exports = router;
