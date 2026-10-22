const express = require('express');
const router = express.Router();
const refundController = require('../controllers/refundController');
const auth = require('../middleware/auth');
const { requireOrganizer } = require('../middleware/rbac');

// ── Customer: request / list own refunds ──
// auth only — any logged-in user can request refunds for tickets they bought.
// The service enforces:
//   - ticket.userId === req.user.id (ownership)
//   - ticket.status === 'active' (not used/cancelled/refunded)
//   - no pending refund already exists for this ticket
//   - event is at least REFUND_WINDOW_MS away
router.post('/refunds', auth, refundController.requestRefund);
router.get('/refunds/my', auth, refundController.getMyRefunds);

// ── Organizer / admin: manage refunds for events ──
// requireOrganizer = ['organizer', 'admin'] — excludes staff (refund approval
// is not a scanner operation) and customers.
//
// The service additionally checks per-event ownership:
//   - Organizer: can only approve/reject refunds where refund.eventId.organizerId
//     matches their own User._id.
//   - Admin: bypasses the ownership check (approve/reject any refund).
// Without the route-level gate, unauthorized callers hit the service check and
// get a confusing error message; with the gate, they get a clean 403 from the
// route layer.
router.get(
  '/refunds/organizer',
  auth,
  requireOrganizer,
  refundController.getOrganizerRefunds
);

router.patch(
  '/refunds/:id/approve',
  auth,
  requireOrganizer,
  refundController.approveRefund
);

router.patch(
  '/refunds/:id/reject',
  auth,
  requireOrganizer,
  refundController.rejectRefund
);

module.exports = router;
