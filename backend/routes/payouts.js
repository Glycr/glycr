const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payoutController');
const auth = require('../middleware/auth');
const { validate, payoutSchema } = require('../middleware/validation');

// Base path: /payouts
router.post('/payouts', auth, validate(payoutSchema), payoutController.requestPayout);
router.get('/payouts', auth, payoutController.getMyPayouts);
router.patch('/payouts/:id/approve', auth, payoutController.approvePayout);
router.patch('/payouts/:id/reject', auth, payoutController.rejectPayout);

module.exports = router;
