const couponService = require('../services/couponService');

// Organizer: Create coupon
exports.createCoupon = async (req, res, next) => {
  try {
    const { code, type, value, expiryDate, usageLimit, eventId } = req.body;
    if (!code || !type || !value || !expiryDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const coupon = await couponService.createCoupon(req.user.id, {
      code, type, value, expiryDate, usageLimit, eventId,
    });
    res.status(201).json(coupon);
  } catch (err) {
    next(err);
  }
};

// Organizer: Get my coupons
exports.getMyCoupons = async (req, res, next) => {
  try {
    const { eventId, isActive } = req.query;
    const coupons = await couponService.getCoupons(req.user.id, { eventId, isActive });
    res.json(coupons);
  } catch (err) {
    next(err);
  }
};

// Public: Get active coupons (for a specific event)
exports.getPublicCoupons = async (req, res, next) => {
  try {
    const { eventId } = req.query;
    const coupons = await couponService.getPublicCoupons(eventId);
    res.json(coupons);
  } catch (err) {
    next(err);
  }
};

// Public: Validate a coupon code
exports.validateCoupon = async (req, res, next) => {
  try {
    const { code, eventId } = req.body;
    if (!code || !eventId) {
      return res.status(400).json({ error: 'Code and eventId required' });
    }
    const coupon = await couponService.validateCoupon(code, eventId, req.user?.id);
    res.json({
      valid: true,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Authenticated: Apply coupon to calculate discount
exports.applyCoupon = async (req, res, next) => {
  try {
    const { code, eventId, subtotal } = req.body;
    if (!code || !eventId || subtotal === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const { discount, coupon } = await couponService.applyCoupon(code, eventId, subtotal, req.user?.id);
    res.json({
      discount: discount.toFixed(2),
      finalTotal: (subtotal - discount).toFixed(2),
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Admin/Organizer: Delete coupon
exports.deleteCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.role === 'admin';
    await couponService.deleteCoupon(id, req.user.id, isAdmin);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
