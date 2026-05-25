const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema({
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  amount: { type: Number, required: true },            // refund amount (could be partial)
  reason: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending',
  },
  requestedAt: { type: Date, default: Date.now },
  processedAt: { type: Date },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: { type: String },
  // For partial refunds (optional)
  isPartial: { type: Boolean, default: false },
  originalPrice: { type: Number },
});

refundSchema.virtual('id').get(function() { return this._id.toString(); });
refundSchema.set('toJSON', { virtuals: true });
refundSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Refund', refundSchema);
