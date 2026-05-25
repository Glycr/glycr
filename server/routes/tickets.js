const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const auth = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const config = require('../config');

// FIX: optionalAuth allows guests through without a token,
// but still populates req.user for logged-in users
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], config.jwtSecret);
  } catch {
    req.user = null;
  }
  next();
};

// Base path: /tickets
router.post('/tickets/purchase', optionalAuth, ticketController.purchase); // FIX: guests can purchase
router.get('/tickets/my', auth, ticketController.getMyTickets);             // still requires login
router.post('/tickets/validate', auth, ticketController.validateTicket);    // still requires login

module.exports = router;
