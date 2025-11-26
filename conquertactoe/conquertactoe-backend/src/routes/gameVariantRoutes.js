const express = require('express');
const router = express.Router();
const gameVariantController = require('../controllers/gameVariantController');

// Public routes - no authentication needed to view variants
router.get('/variants', gameVariantController.getAllVariants);
router.get('/variants/:id', gameVariantController.getVariantById);
router.get('/variants/:id/rules', gameVariantController.getVariantRules);

module.exports = router;
