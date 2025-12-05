// ============================================
// FILE: models/User.js
// ============================================
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  isOrganizer: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  suspended: { type: Boolean, default: false },
  currency: { type: String, default: 'GHC' },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
