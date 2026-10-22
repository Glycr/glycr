const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  type: { type: String, enum: ['percentage', 'fixed'], required: true },
  value: { type: Number, required: true, min: 0 },
  expiryDate: { type: Date, required: true },
  usageLimit: { type: Number, default: null },
  usedCount: { type: Number, default: 0 },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null }, // null = all events
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

// ── Indexes ──
// Cover the queries in couponService.js:
//   find({ organizerId }).sort({ createdAt: -1 })         → getCoupons
//   find({ isActive: true, expiryDate: { $gt: now } })     → getPublicCoupons
//   find({ eventId })                                       → getCoupons event filter
couponSchema.index({ organizerId: 1, createdAt: -1 });
couponSchema.index({ isActive: 1, expiryDate: 1 });
couponSchema.index({ eventId: 1 });

couponSchema.virtual('id').get(function() { return this._id.toString(); });
couponSchema.set('toJSON', { virtuals: true });
couponSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Coupon', couponSchema);
