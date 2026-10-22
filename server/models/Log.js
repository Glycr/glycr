const mongoose = require('mongoose');

const TYPES = ['auth', 'event', 'payout', 'user', 'system', 'warning', 'danger'];

// Days to keep each type; null = keep forever. Adjust to your compliance needs.
const RETENTION_DAYS = {
  system: 30, event: 180, warning: 180, danger: 365, auth: 365, user: 365, payout: null,
};
const DAY_MS = 24 * 60 * 60 * 1000;

// Fail fast at load if TYPES and RETENTION_DAYS drift apart. A type present
// in TYPES but missing from RETENTION_DAYS would silently default to "keep
// forever" in the pre('validate') hook (because `if (days)` fails on
// undefined), which is the opposite of the intent — new types should opt
// into a retention window explicitly.
for (const t of TYPES) {
  if (!(t in RETENTION_DAYS)) {
    throw new Error(`models/Log.js: RETENTION_DAYS missing entry for type "${t}"`);
  }
}

const logSchema = new mongoose.Schema(
  {
    type: { type: String, enum: TYPES, required: true, immutable: true },
    level: { type: String, enum: ['info', 'warn', 'error'], default: 'info', immutable: true },
    message: { type: String, required: true, maxlength: 1000, immutable: true },
    actor: { type: String, maxlength: 200, immutable: true },   // name/email snapshot at write time
    action: { type: String, maxlength: 100, immutable: true },
    target: { type: String, maxlength: 300, immutable: true },
    ip: { type: String, maxlength: 64, immutable: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', immutable: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {}, immutable: true },
    expireAt: { type: Date, immutable: true },                  // absent = never expires
  },
  {
    timestamps: { createdAt: 'timestamp', updatedAt: false },   // keeps the field name your panel uses
    versionKey: false,
  }
);

logSchema.pre('validate', function () {
  const days = RETENTION_DAYS[this.type];
  if (this.isNew && !this.expireAt && days) this.expireAt = new Date(Date.now() + days * DAY_MS);
});

logSchema.index({ timestamp: -1 });                    // unfiltered recent list
logSchema.index({ type: 1, timestamp: -1 });           // type filter
logSchema.index({ adminId: 1, timestamp: -1 });        // "what did this person do"
logSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

logSchema.virtual('id').get(function () { return this._id.toString(); });
logSchema.set('toJSON', { virtuals: true });
logSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Log', logSchema);
