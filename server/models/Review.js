const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true, index: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    rating:  { type: Number, required: true, min: 1, max: 5 },
    text:    { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

// one review per user per event, enforced by the database
reviewSchema.index({ userId: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
