// ============================================
// FILE: models/Event.js
// ============================================
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  venue: { type: String, required: true },
  location: { type: String, required: true },
  category: { type: String, required: true },
  currency: { type: String, default: 'GHC' },
  organizerEmail: { type: String, required: true },
  organizerPhone: { type: String, required: true },
  image: String,
  ticketTypes: {
    type: Map,
    of: {
      price: Number,
      capacity: Number,
      sold: { type: Number, default: 0 },
      earlyBirdPrice: Number,
      earlyBirdEnd: Date,
      groupDiscount: { type: Number, default: 10 }
    }
  },
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isPublished: { type: Boolean, default: true },
  isCancelled: { type: Boolean, default: false },
  flagged: { type: Boolean, default: false },
  shareCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Event', eventSchema);
