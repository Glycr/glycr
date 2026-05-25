const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['auth', 'event', 'payout', 'user', 'system', 'warning', 'danger'],
    required: true,
  },
  message: { type: String, required: true },
  meta: { type: Object, default: {} },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now },
});

logSchema.virtual('id').get(function() { return this._id.toString(); });
logSchema.set('toJSON', { virtuals: true });
logSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Log', logSchema);
