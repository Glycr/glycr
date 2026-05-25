const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 10 },
  method: { type: String, enum: ['bank', 'momo', 'paypal'], required: true },
  status: { type: String, enum: ['pending', 'completed', 'rejected'], default: 'pending' },
  email: { type: String, required: true },
  notes: { type: String },
  details: { type: Object },
  requestedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  rejectionReason: { type: String },
});

payoutSchema.virtual('id').get(function() { return this._id.toString(); });
payoutSchema.set('toJSON', { virtuals: true });
payoutSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Payout', payoutSchema);
