const express = require('express');
const router = express.Router();
const serviceRequestController = require('../controllers/serviceRequestController');
const optionalAuth = require('../middleware/optionalAuth');
const { submitLimiter } = require('../middleware/rateLimit');

// ── Public: submit a support request ──
// optionalAuth: guests pass through (req.user = null), logged-in users get
// their identity resolved by the controller (userId linked, email from JWT,
// audit fired in MongoDB).
// submitLimiter: 5 submissions per IP per hour — matches the public form's
// abuse profile (real users file 1-2 tickets, spam bots fill the collection).
router.post(
  '/service-requests',
  submitLimiter,
  optionalAuth,
  serviceRequestController.createRequest
);

module.exports = router;
