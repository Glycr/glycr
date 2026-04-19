const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ticketType: { type: String, required: true },
  price: { type: Number, required: true },
  purchasedAt: { type: Date, default: Date.now },
  userEmail: { type: String, required: true },
  userPhone: { type: String, required: true },
  companyName: { type: String },
  billingAddress: { type: String },
  poNumber: { type: String },
  validated: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'used', 'cancelled'], default: 'active' }, // <-- new
});

module.exports = mongoose.model('Ticket', ticketSchema);
