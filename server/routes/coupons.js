const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const auth = require('../middleware/auth');

// Public routes (no authentication required)
router.get('/coupons/public', couponController.getPublicCoupons);
router.post('/coupons/validate', couponController.validateCoupon);

// Authenticated routes
router.use(auth);

router.get('/coupons', couponController.getMyCoupons);
router.post('/coupons', couponController.createCoupon);
router.post('/coupons/apply', couponController.applyCoupon);
router.delete('/coupons/:id', couponController.deleteCoupon);

module.exports = router;
