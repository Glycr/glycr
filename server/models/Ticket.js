// models/Ticket.js
const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },   // public ticket code (UUID)
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },  // null for guest purchases
  ticketType: { type: String, required: true },
  price: { type: Number, required: true },
  purchasedAt: { type: Date, default: Date.now },

  // Attendee contact
  userEmail: { type: String, required: true, lowercase: true, trim: true },
  userPhone: { type: String, default: null, match: /^\+233\d{9}$/ },
  buyerName: { type: String, default: null },

  // Payment / refund traceability
  paymentIntentId: { type: String, default: null },      // Stripe / Paystack reference
  paymentGateway:  { type: String, enum: ['stripe', 'paystack', 'paypal', 'manual'], default: null },

  // Purchase details
  promoCode: { type: String, default: null },
  discountAmount: { type: Number, default: 0 },
  companyName: { type: String },
  billingAddress: { type: String },
  poNumber: { type: String },

  // Lifecycle flags
  validated: { type: Boolean, default: false },
  validatedAt: { type: Date, default: null },
  validatedBy: { type: String, default: null },

  refunded: { type: Boolean, default: false },
  refundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Refund', default: null },
  refundedAt: { type: Date, default: null },

  status: {
    type: String,
    enum: ['active', 'used', 'cancelled', 'refunded', 'refund_pending'],
    default: 'active',
  },
}, { timestamps: true });

// --- Indexes (query performance) ---
ticketSchema.index({ eventId: 1, status: 1 });
ticketSchema.index({ eventId: 1, purchasedAt: 1 });
ticketSchema.index({ userId: 1, purchasedAt: -1 });
ticketSchema.index({ status: 1 });
ticketSchema.index({ paymentIntentId: 1 }, { sparse: true });

module.exports = mongoose.model('Ticket', ticketSchema);
