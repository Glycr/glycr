const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  createdAt: { type: Date, default: Date.now },
});

// Prevent duplicate favorites (also serves as the index for find({ userId }))
favoriteSchema.index({ userId: 1, eventId: 1 }, { unique: true });

// Per-event queries — not used by current code, but cheap insurance for
// future features ("most favorited events", per-event analytics, or
// cleanup scripts that delete favorites for a specific event)
favoriteSchema.index({ eventId: 1 });

favoriteSchema.virtual('id').get(function () { return this._id.toString(); });
favoriteSchema.set('toJSON',   { virtuals: true });
favoriteSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
