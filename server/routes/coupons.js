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
// users get req.user populated. Must be defined BEFORE the blanket
// `router.use(auth)` below, otherwise auth runs first and 401s guests.
//
// Controller uses req.user?.id (optional) — this endpoint was always
// intended for both authenticated and guest flows.
router.post('/coupons/apply', optionalAuth, couponController.applyCoupon);

// ── Authenticated + organizer-only: coupon management ──
// Everything below requires a valid JWT via router.use(auth).
router.use(auth);

// requireOrganizerOnly on the three mutation/listing routes:
//   - Without it, any customer could POST /coupons with a 100%-off code
//     pointing at any event, then use it at checkout → free ticket.
//   - Admins manage coupons via /admin/coupons (global view); they don't
//     need to create per-event coupons here.
//   - The service still enforces per-event ownership on delete; the route
//     gate ensures customers never even reach it.
router.get(
  '/coupons',
  requireOrganizerOnly,
  couponController.getMyCoupons
);

router.post(
  '/coupons',
  requireOrganizerOnly,
  couponController.createCoupon
);

router.delete(
  '/coupons/:id',
  requireOrganizerOnly,
  couponController.deleteCoupon
);

module.exports = router;
