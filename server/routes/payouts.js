const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payoutController');
const auth = require('../middleware/auth');
const { requireOrganizerOnly } = require('../middleware/rbac');
const { validate, payoutSchema } = require('../middleware/validation');

// ── Organizer: request a payout ──
// requireOrganizerOnly — admins don't request payouts (they have no events).
// The service also checks organizer.isOrganizer as defense-in-depth, but the
// route gate gives a clean 403 instead of "Only organizers can request payouts"
// from deep in the service.
//
// payoutSchema validates:
//   - amount >= 10
//   - method in ['bank', 'mobile_money', 'paypal', 'stripe']
//   - email is valid
//   - bankDetails required+conditional when method=bank
//   - momoDetails required+conditional when method=mobile_money
//   - notes optional, ≤ 500 chars
router.post(
  '/payouts',
  auth,
  requireOrganizerOnly,
  validate(payoutSchema),
  payoutController.requestPayout
);

// ── Organizer: view own payout history ──
// Without requireOrganizerOnly, a customer calling this got 200 with [] (silent
// empty). With the gate, they get a clean 403 — matches what the frontend
// should expect (customers shouldn't be able to "view payouts" at all).
router.get(
  '/payouts',
  auth,
  requireOrganizerOnly,
  payoutController.getMyPayouts
);

// ── Approve/reject removed ──
// The old routes:
//   router.patch('/payouts/:id/approve', auth, payoutController.approvePayout);
//   router.patch('/payouts/:id/reject',  auth, payoutController.rejectPayout);
// were deleted from payoutController in the controller-review pass — the
// controller methods called parseInt(req.params.id) on a 24-char ObjectId,
// which truncated to a small integer and always failed. Any request to these
// routes returned 500 "TypeError: payoutController.approvePayout is not a
// function".
//
// Admin payout management lives at:
//   PATCH /api/admin/payouts/:id/approve   ← routes/admin.js
//   PATCH /api/admin/payouts/:id/reject    ← routes/admin.js
// Those are gated by requireAdmin (from the admin.js role fix), delegate to
// adminController.approvePayout → payoutService.approvePayout, which has the
// available-balance re-check, atomic transition, and processedBy recording.

module.exports = router;
