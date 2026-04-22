const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  platformFee: { type: Number, default: 3, min: 0, max: 50 },
  updatedAt: { type: Date, default: Date.now },
  refundDeadlineDays: { type: Number, default: 7 },
});

settingsSchema.virtual('id').get(function() { return this._id.toString(); });
settingsSchema.set('toJSON', { virtuals: true });
settingsSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Settings', settingsSchema);
