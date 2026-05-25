const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true, match: /^\+233\d{9}$/ },
  role: { type: String, enum: ['customer', 'organizer', 'moderator', 'admin'], default: 'customer' },
  isOrganizer: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  suspended: { type: Boolean, default: false },
  currency: { type: String, default: 'GHC' },
  createdAt: { type: Date, default: Date.now },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
});

userSchema.virtual('id').get(function() { return this._id.toString(); });
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });
userSchema.virtual('isLocked').get(function() {
  return this.lockUntil && this.lockUntil > Date.now();
});

module.exports = mongoose.model('User', userSchema);
