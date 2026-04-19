const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const auth = require('../middleware/auth');

// Base path: /tickets
router.post('/tickets/purchase', auth, ticketController.purchase);
router.get('/tickets/my', auth, ticketController.getMyTickets);
router.post('/tickets/validate', auth, ticketController.validateTicket);

module.exports = router;
