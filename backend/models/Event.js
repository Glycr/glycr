const mongoose = require('mongoose');

const ticketTypeSchema = new mongoose.Schema({
  price: { type: Number, required: true, min: 0 },
  capacity: { type: Number, required: true, min: 1 },
  sold: { type: Number, default: 0 },
  earlyBirdPrice: { type: Number },
  earlyBirdEnd: { type: Date },
  groupDiscount: { type: Number, default: 10 },
});

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  venue: { type: String, required: true },
  location: { type: String },
  category: { type: String, required: true },
  currency: { type: String, required: true },
  image: { type: String },
  ticketTypes: { type: Map, of: ticketTypeSchema, required: true },
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organizerEmail: { type: String, required: true },
  organizerPhone: { type: String, required: true },
  isPublished: { type: Boolean, default: true },
  isCancelled: { type: Boolean, default: false },
  flagged: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

eventSchema.virtual('id').get(function() { return this._id.toString(); });
eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Event', eventSchema);
