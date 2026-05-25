const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const auth = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

router.get('/admin/messages', auth, roleMiddleware(['admin', 'moderator']), messageController.getAllMessages);
router.post('/admin/messages', auth, roleMiddleware(['admin', 'moderator']), messageController.createDirectMessage);
router.post('/admin/messages/broadcast', auth, roleMiddleware(['admin', 'moderator']), messageController.createBroadcast);
router.delete('/admin/messages/:id', auth, roleMiddleware(['admin', 'moderator']), messageController.deleteMessage);

module.exports = router;
