// models/Payout.js
const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount:      { type: Number, required: true, min: 10 },
  method: {
    type: String,
    enum: ['bank', 'mobile_money', 'paypal', 'stripe'],
    required: true,
    index: true,
  },
  // pending   → requested, waiting for review
  // approved  → approved, money reserved but not sent yet
  // completed → money sent and the payment reference recorded
  // rejected  → declined, or an approved payout that could not be sent
  status: {
    type: String,
    enum: ['pending', 'approved', 'completed', 'rejected'],
    default: 'pending',
    index: true,
  },
  email:       { type: String, required: true, lowercase: true, trim: true },
  notes:       { type: String, default: '' },
  details:     { type: mongoose.Schema.Types.Mixed, default: {} },
  requestedAt: { type: Date, default: Date.now },
  approvedAt:  { type: Date, default: null },            // when an admin approved it
  // completedAt = when the money was sent (also used as "processed at" for rejections)
  completedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: null },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },  // who approved/rejected
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },  // who sent the money
  // Transaction ID of the transfer (MoMo reference, bank reference, ...)
  paymentReference: { type: String, trim: true, maxlength: 100, default: null },
});

payoutSchema.virtual('id').get(function () { return this._id.toString(); });
payoutSchema.set('toJSON',   { virtuals: true });
payoutSchema.set('toObject', { virtuals: true });

// Compound index for admin filter queries (status + date sort)
payoutSchema.index({ organizerId: 1, status: 1, requestedAt: -1 });
// Standalone index for the admin "all payouts" page (sort by date, no filter)
payoutSchema.index({ requestedAt: -1 });

module.exports = mongoose.model('Payout', payoutSchema);
