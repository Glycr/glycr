const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  ticketType: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  joinedAt: { type: Date, default: Date.now },
  notified: { type: Boolean, default: false },
});

waitlistSchema.virtual('id').get(function() { return this._id.toString(); });
waitlistSchema.set('toJSON', { virtuals: true });
waitlistSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Waitlist', waitlistSchema);
