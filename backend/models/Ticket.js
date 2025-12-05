// ============================================
// FILE: models/Ticket.js
// ============================================
const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  ticketId: { type: String, required: true, unique: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userEmail: { type: String, required: true },
  userPhone: { type: String, required: true },
  ticketType: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, default: 1 },
  companyName: String,
  billingAddress: String,
  poNumber: String,
  paymentMethod: { type: String, required: true },
  paymentStatus: { type: String, default: 'completed' },
  qrCode: String,
  validated: { type: Boolean, default: false },
  validatedAt: Date,
  purchasedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ticket', ticketSchema);
