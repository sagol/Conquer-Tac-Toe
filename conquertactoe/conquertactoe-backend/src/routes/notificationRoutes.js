const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');

router.get('/', ensureAuthenticated, notificationController.getNotifications);
router.put('/:id/read', ensureAuthenticated, notificationController.markRead);
router.put('/read-all', ensureAuthenticated, notificationController.markAllRead);
router.post('/system', ensureAuthenticated, ensureAdmin, notificationController.createSystemNotification);

module.exports = router;
