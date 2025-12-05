// ============================================
// FILE: models/Waitlist.js
// ============================================
const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  ticketType: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  notified: { type: Boolean, default: false },
  joinedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Waitlist', waitlistSchema);
