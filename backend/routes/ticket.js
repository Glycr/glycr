// ============================================
// FILE: routes/ticketRoutes.js
// ============================================
const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { authenticateToken, requireOrganizer } = require('../middleware/auth');

router.post('/purchase', authenticateToken, ticketController.purchaseTicket);
router.get('/my-tickets', authenticateToken, ticketController.getMyTickets);
router.post('/:ticketId/validate', authenticateToken, requireOrganizer, ticketController.validateTicket);

module.exports = router;
