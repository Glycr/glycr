const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const staffSchema = new mongoose.Schema({
  staffId:     { type: String, required: true, unique: true },
  name:        { type: String, required: true, trim: true },
  email:       {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  phone:       { type: String, default: null, match: /^\+233\d{9}$/ },
  role:        { type: String, enum: ['scanner', 'supervisor'], default: 'scanner' },
  pin:         { type: String, default: null, select: false },         // bcrypt-hashed 4-8 digit PIN
  eventId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
  status:      { type: String, enum: ['active', 'inactive'], default: 'active' },
  lastLoginAt: { type: Date, default: null },
  createdAt:   { type: Date, default: Date.now },
});

// Hash PIN before save
staffSchema.pre('save', async function () {
  if (this.isModified('pin') && this.pin && !/^\$2/.test(this.pin)) {
    this.pin = await bcrypt.hash(this.pin, 10);
  }
});

// verifyPin is always async — returns Promise<boolean>
staffSchema.methods.verifyPin = async function (plain) {
  if (!this.pin) return false;
  return bcrypt.compare(plain, this.pin);
};

// ── Indexes ──
// Cover queries in staffService.js:
//   findOne({ organizerId, email })          → createStaff duplicate check
//   find({ organizerId }).sort({ createdAt }) → listStaff
//   find({ organizerId, eventId })            → listStaff with event filter
//   find({ status: 'active', pin: { $ne: null } }) → pinLogin candidate fetch
staffSchema.index({ organizerId: 1, email: 1 }, { unique: true });
staffSchema.index({ organizerId: 1, createdAt: -1 });
staffSchema.index({ organizerId: 1, eventId: 1 });
staffSchema.index({ status: 1, pin: 1 });

staffSchema.virtual('id').get(function () { return this._id.toString(); });

const transform = (_, ret) => { delete ret.pin; return ret; };
staffSchema.set('toJSON',   { virtuals: true, transform });
staffSchema.set('toObject', { virtuals: true, transform });

module.exports = mongoose.model('Staff', staffSchema);
