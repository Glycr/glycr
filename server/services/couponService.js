const Coupon = require('../models/Coupon');
const Event = require('../models/Event');

class CouponService {
  async createCoupon(organizerId, couponData) {
    const { code, type, value, expiryDate, usageLimit, eventId } = couponData;
    const existing = await Coupon.findOne({ code: code.toUpperCase() });
    if (existing) throw new Error('Coupon code already exists');

    const coupon = new Coupon({
      code: code.toUpperCase(),
      type,
      value,
      expiryDate,
      usageLimit: usageLimit || null,
      eventId: eventId || null,
      organizerId,
    });
    await coupon.save();
    return coupon;
  }

  async getCoupons(organizerId, filters = {}) {
    const query = { organizerId };
    if (filters.eventId) query.eventId = filters.eventId;
    if (filters.isActive !== undefined) query.isActive = filters.isActive;
    const coupons = await Coupon.find(query).sort({ createdAt: -1 });
    return coupons;
  }

  async getPublicCoupons(eventId = null) {
    const query = { isActive: true, expiryDate: { $gt: new Date() } };
    if (eventId) query.eventId = { $in: [eventId, null] };
    const coupons = await Coupon.find(query).limit(50);
    return coupons;
  }

  async validateCoupon(code, eventId, userId = null) {
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon) throw new Error('Invalid coupon code');
    if (!coupon.isActive) throw new Error('Coupon is not active');
    if (new Date() > coupon.expiryDate) throw new Error('Coupon has expired');
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw new Error('Coupon usage limit reached');
    if (coupon.eventId && coupon.eventId.toString() !== eventId) throw new Error('Coupon not valid for this event');
    return coupon;
  }

  async applyCoupon(code, eventId, subtotal, userId) {
    const coupon = await this.validateCoupon(code, eventId, userId);
    let discount = 0;
    if (coupon.type === 'percentage') {
      discount = subtotal * (coupon.value / 100);
    } else {
      discount = Math.min(coupon.value, subtotal);
    }
    return { discount, coupon };
  }

  async incrementUsage(couponId) {
    const coupon = await Coupon.findById(couponId);
    if (!coupon) throw new Error('Coupon not found');
    coupon.usedCount += 1;
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      coupon.isActive = false;
    }
    await coupon.save();
    return coupon;
  }

  async deleteCoupon(couponId, organizerId, isAdmin = false) {
    const coupon = await Coupon.findById(couponId);
    if (!coupon) throw new Error('Coupon not found');
    if (!isAdmin && coupon.organizerId.toString() !== organizerId) throw new Error('Unauthorized');
    await coupon.deleteOne();
    return true;
  }
}

module.exports = new CouponService();
