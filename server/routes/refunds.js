const express = require('express');
const router = express.Router();
const refundController = require('../controllers/refundController');
const auth = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

// Customer routes
router.post('/refunds', auth, refundController.requestRefund);
router.get('/refunds/my', auth, refundController.getMyRefunds);

// Organizer routes (for events they own)
router.get('/refunds/organizer', auth, refundController.getOrganizerRefunds);
router.patch('/refunds/:id/approve', auth, refundController.approveRefund);
router.patch('/refunds/:id/reject', auth, refundController.rejectRefund);



module.exports = router;
