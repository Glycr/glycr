const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
  requestId: { type: String, unique: true, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
  category: {
    type: String,
    enum: ['ticket_issue', 'payment_problem', 'refund_request', 'organizer_support', 'account_issue', 'bug_report', 'other'],
    default: 'other',
  },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'resolved'],
    default: 'pending',
  },
  submittedAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date },
  resolutionNotes: { type: String },
});

// Compound index for daily position counting (optional but helps performance)
serviceRequestSchema.index({ submittedAt: 1 });
serviceRequestSchema.virtual('id').get(function() { return this._id.toString(); });
serviceRequestSchema.set('toJSON', { virtuals: true });
serviceRequestSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
