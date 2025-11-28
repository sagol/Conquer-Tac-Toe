const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');

/**
 * @route   GET /api/config/public
 * @desc    Get all public configuration values
 * @access  Public
 */
router.get('/public', configController.getPublicConfigs);

module.exports = router;
