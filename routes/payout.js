// ============================================
// FILE: routes/payoutRoutes.js
// ============================================
const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payoutController');
const { authenticateToken, requireOrganizer } = require('../middleware/auth');

router.post('/', authenticateToken, requireOrganizer, payoutController.requestPayout);
router.get('/', authenticateToken, requireOrganizer, payoutController.getPayouts);

module.exports = router;

