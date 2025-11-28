const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/auth/google', authController.googleAuth);
router.get('/auth/google/callback', authController.googleAuthCallback);
router.get('/logout', authController.logout);
router.post('/auth/dev_login', authController.devLogin);
router.get('/current_user', authController.currentUser);

module.exports = router;
