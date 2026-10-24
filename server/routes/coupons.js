const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const auth = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const { requireOrganizerOnly } = require('../middleware/rbac');

// ── Public: pricing UI needs these before login ──
// /coupons/public: list active coupons for an event (shown on event detail).
// /coupons/validate: check if a code is valid (shown as the user types).
router.get('/coupons/public', couponController.getPublicCoupons);
router.post('/coupons/validate', couponController.validateCoupon);

// ── Guest-allowed: apply a code at checkout ──
// optionalAuth: guests can apply coupons during guest checkout; logged-in
// users get req.user populated.
router.post('/coupons/apply', optionalAuth, couponController.applyCoupon);

// ── Authenticated + organizer-only: coupon management ──
// auth is applied per-route (NOT router.use(auth)) so this sub-router
// cannot 401 unrelated /api/* requests that fall through it — e.g.
// POST /api/service-requests. A pathless router.use(auth) here would
// reject every guest request that enters this router without matching
// one of the routes above.
//   - requireOrganizerOnly prevents any customer from POSTing a 100%-off
//     code pointing at any event → free ticket.
//   - Admins manage coupons via /admin/coupons (global view); they don't
//     need to create per-event coupons here.
//   - The service still enforces per-event ownership on delete.
router.get('/coupons', auth, requireOrganizerOnly, couponController.getMyCoupons);

router.post('/coupons', auth, requireOrganizerOnly, couponController.createCoupon);

router.delete('/coupons/:id', auth, requireOrganizerOnly, couponController.deleteCoupon);

module.exports = router;
