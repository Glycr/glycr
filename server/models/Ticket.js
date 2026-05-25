const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, default: null }, // FIX: not required for guest purchases
  ticketType: { type: String, required: true },
  price: { type: Number, required: true },
  purchasedAt: { type: Date, default: Date.now },
  userEmail: { type: String, required: true },
  userPhone: { type: String, required: true },
  promoCode: { type: String, default: null },
  discountAmount: { type: Number, default: 0 },
  companyName: { type: String },
  billingAddress: { type: String },
  poNumber: { type: String },
  validated: { type: Boolean, default: false },
  refunded: { type: Boolean, default: false },
  refundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Refund' },
  status: { type: String, enum: ['active', 'used', 'cancelled', 'refunded', 'refund_pending'], default: 'active' },
});

module.exports = mongoose.model('Ticket', ticketSchema);
