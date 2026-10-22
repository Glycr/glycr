const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  username: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-z0-9_.]+$/,
  },
  password: { type: String, required: true, select: false },
  phone: { type: String, required: true, match: /^\+233\d{9}$/ },
  role: { type: String, enum: ['customer', 'organizer', 'moderator', 'admin'], default: 'customer' },
  isOrganizer: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  suspended: { type: Boolean, default: false },
  currency: { type: String, default: 'GHC' },
  passwordChangedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
});

// ── Indexes ──
// Cover the queries in adminService.getStats / messageService.createBroadcast /
// userService.getAllUsers:
//   find({ role })                          → getStats, createBroadcast
//   find({ isOrganizer })                   → getAllUsers filter
//   find({ suspended })                     → getAllUsers filter
//   find({ isOrganizer, suspended })        → getAllUsers both filters
userSchema.index({ role: 1 });
userSchema.index({ isOrganizer: 1, suspended: 1 });
userSchema.index({ suspended: 1 });

userSchema.virtual('id').get(function() { return this._id.toString(); });
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });
userSchema.virtual('isLocked').get(function() {
  return this.lockUntil && this.lockUntil > Date.now();
});

module.exports = mongoose.model('User', userSchema);
