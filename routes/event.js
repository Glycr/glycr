// ============================================
// FILE: routes/eventRoutes.js
// ============================================
const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authenticateToken, requireOrganizer } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', eventController.getAllEvents);
router.get('/:id', eventController.getEvent);
router.post('/', authenticateToken, requireOrganizer, upload.single('image'), eventController.createEvent);
router.put('/:id', authenticateToken, requireOrganizer, upload.single('image'), eventController.updateEvent);
router.delete('/:id', authenticateToken, requireOrganizer, eventController.deleteEvent);
router.post('/:id/cancel', authenticateToken, requireOrganizer, eventController.cancelEvent);
router.post('/:id/share', eventController.shareEvent);

module.exports = router;
