const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const staffSchema = new mongoose.Schema({
  staffId:     { type: String, required: true, unique: true },
  name:        { type: String, required: true, trim: true },
  email:       { type: String, required: true, lowercase: true, trim: true },
  phone:       { type: String, default: null },
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

staffSchema.methods.verifyPin = function (plain) {
  if (!this.pin) return false;
  return bcrypt.compare(plain, this.pin);
};

staffSchema.virtual('id').get(function () { return this._id.toString(); });
staffSchema.set('toJSON', { virtuals: true, transform: (_, ret) => { delete ret.pin; return ret; } });

module.exports = mongoose.model('Staff', staffSchema);
