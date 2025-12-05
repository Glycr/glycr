
// ============================================
// FILE: routes/waitlistRoutes.js
// ============================================
const express = require('express');
const router = express.Router();
const waitlistController = require('../controllers/waitlistController');
const { authenticateToken, requireOrganizer } = require('../middleware/auth');

router.post('/', waitlistController.joinWaitlist);
router.get('/:eventId/:ticketType', authenticateToken, requireOrganizer, waitlistController.getWaitlist);
router.post('/notify/:eventId/:ticketType', authenticateToken, requireOrganizer, waitlistController.notifyWaitlist);

module.exports = router;
