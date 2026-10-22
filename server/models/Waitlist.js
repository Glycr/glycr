const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  ticketType: { type: String, required: true },
  name: { type: String, required: true },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  phone: { type: String, required: true, match: /^\+233\d{9}$/ },
  joinedAt: { type: Date, default: Date.now },
  notified: { type: Boolean, default: false },
  notifiedAt: { type: Date, default: null },   // when last notified — used by cooldown check
  position: { type: Number, default: null },
});

// --- Indexes ---
// Cover the queries in waitlistService.js:
//   findOne({ eventId, ticketType, email })               → joinWaitlist duplicate check
//   countDocuments({ eventId, ticketType })               → joinWaitlist position
//   find({ eventId, ticketType }).sort({ joinedAt: 1 })   → getWaitlist, notifyWaitlist
//   countDocuments({ eventId, ticketType, notified: false }) → notifyWaitlist remaining
//   find().sort({ joinedAt: -1 })                         → getAllWaitlists (admin)

// Unique index — also serves as the findOne duplicate-check index
waitlistSchema.index(
  { eventId: 1, ticketType: 1, email: 1 },
  { unique: true }
);

// Compound for queue ordering + notified-count queries
waitlistSchema.index({ eventId: 1, ticketType: 1, joinedAt: 1 });
waitlistSchema.index({ eventId: 1, ticketType: 1, notified: 1 });

// Admin list across all events
waitlistSchema.index({ joinedAt: -1 });

waitlistSchema.virtual('id').get(function() { return this._id.toString(); });
waitlistSchema.set('toJSON', { virtuals: true });
waitlistSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Waitlist', waitlistSchema);
