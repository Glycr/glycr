const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const auth = require('../middleware/auth');
const { requireOrganizerOnly } = require('../middleware/rbac');

// ── Organizer: own sales trend ──
// requireOrganizerOnly — analytics is inherently per-organizer. Without the
// gate, customers/moderators/admins/staff hit the endpoint and get 200 with
// a 7-day array of zeros (service queries Event.find({ organizerId: their_id })
// → empty → empty trend). Silent confusion.
//
// Admins don't organize events. If you ever need cross-organizer analytics
// for admins, add a separate /admin/analytics endpoint that accepts
// ?organizerId=X with requireAdmin — don't relax this route.
//
// The controller also guards `if (!req.user?.id)` — redundant with `auth`
// + `requireOrganizerOnly`, but harmless defense-in-depth.
router.get(
  '/analytics/sales-trend',
  auth,
  requireOrganizerOnly,
  analyticsController.getSalesTrend
);

router.get(
  '/analytics/organizer-summary',
  auth,
  requireOrganizerOnly,
  analyticsController.getOrganizerSummary
);

module.exports = router;
