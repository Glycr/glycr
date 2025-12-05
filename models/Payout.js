// ============================================
// FILE: models/Payout.js
// ============================================
const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  method: { type: String, required: true, enum: ['bank', 'momo', 'paypal'] },
  status: { type: String, default: 'pending', enum: ['pending', 'completed', 'rejected'] },
  email: { type: String, required: true },
  notes: String,
  details: {
    bankName: String,
    accountNumber: String,
    accountName: String,
    phone: String
  },
  rejectionReason: String,
  requestedAt: { type: Date, default: Date.now },
  completedAt: Date
});

module.exports = mongoose.model('Payout', payoutSchema);
