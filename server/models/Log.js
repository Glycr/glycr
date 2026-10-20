const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['auth', 'event', 'payout', 'user', 'system', 'warning', 'danger'],
    required: true,
  },
  message: { type: String, required: true },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },   // <- replaced
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now },
});

// Indexes <- added
logSchema.index({ timestamp: -1 });
logSchema.index({ type: 1, timestamp: -1 });
// Optional: auto-delete after 90 days
logSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

logSchema.virtual('id').get(function () { return this._id.toString(); });
logSchema.set('toJSON', { virtuals: true });
logSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Log', logSchema);
