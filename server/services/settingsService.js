// services/settingsService.js
const Settings = require('../models/Settings');
const { AppError } = require('../utils/appError');
const { logger } = require('../config/logger');

// Fields an admin is allowed to update via this API.
// Anything not listed is silently ignored.
//
// Only include fields here that have a real consumer somewhere in the
// services layer. If you add a field here without wiring it up, admin
// updates will look successful but nothing will actually change.
//
// To add a field: (1) add to this list, (2) add a validator below,
// (3) add the field to models/Settings.js, AND (4) read it from the
// relevant service.
//
//   platformFee      → the percentage (kept under its original name so the
//                      website, the admin panel and the payout/analytics
//                      services that already read it keep working)
//   platformFeeFloor → minimum fee per order, in Ghana cedis (0 = no minimum)
//   feePaidBy        → platform default for who pays the fee: 'organizer'
//                      (deducted from their sales) or 'buyer' (added at
//                      checkout). An event can override it.
const EDITABLE_FIELDS = [
  'platformFee',
  'platformFeeFloor',
  'feePaidBy',
  'refundDeadlineDays',
];

const FEE_PAYERS = ['organizer', 'buyer'];

// The minimum fee is written in cedis, so it only applies to events priced in
// cedis. Events in other currencies pay the percentage only.
const FLOOR_CURRENCY = 'GHC';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const validators = {
  platformFee: (v) => {
    // Aligned with schema: max 50 (a 100% platform fee is not a real config)
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 50) {
      throw new AppError('platformFee must be a number between 0 and 50', 400);
    }
  },
  platformFeeFloor: (v) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 50) {
      throw new AppError('platformFeeFloor must be a number of cedis between 0 and 50', 400);
    }
  },
  feePaidBy: (v) => {
    if (!FEE_PAYERS.includes(v)) {
      throw new AppError('feePaidBy must be "organizer" or "buyer"', 400);
    }
  },
  refundDeadlineDays: (v) => {
    if (!Number.isInteger(v) || v < 1 || v > 90) {
      throw new AppError('refundDeadlineDays must be an integer between 1 and 90', 400);
    }
  },
};

class SettingsService {
  async getSettings() {
    // Atomic upsert — prevents the race where two concurrent requests both
    // find nothing and both create a settings doc (leaving duplicates behind).
    // The defaults change nothing for existing platforms: 3%, no minimum,
    // and the organizer pays.
    return Settings.findOneAndUpdate(
      {},
      { $setOnInsert: { platformFee: 3, platformFeeFloor: 0, feePaidBy: 'organizer' } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
  }

  async updateSettings(updates) {
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      throw new AppError('Settings updates must be an object', 400);
    }

    // Reject prototype-pollution keys before anything else
    for (const key of Object.keys(updates)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new AppError('Invalid settings update', 400);
      }
    }

    // Build a clean patch: whitelist + validate each field
    const clean = {};
    for (const [key, value] of Object.entries(updates)) {
      if (!EDITABLE_FIELDS.includes(key)) continue; // unknown fields silently dropped
      validators[key]?.(value);                     // throws AppError on invalid value
      clean[key] = value;
    }

    if (Object.keys(clean).length === 0) {
      throw new AppError('No valid settings fields to update', 400);
    }

    const settings = await this.getSettings();

    // Capture pre-update values for the audit log
    const before = {};
    for (const key of Object.keys(clean)) before[key] = settings[key];

    settings.set(clean);
    settings.updatedAt = new Date();
    await settings.save();

    logger.info('Settings updated', {
      changedFields: Object.keys(clean),
      before,
      after: clean,
    });

    return settings;
  }

  // ── fee calculation ─────────────────────────────────────────────

  // Fee for ONE order (one payment): the larger of the percentage and the
  // minimum, but never more than the order itself. Free orders pay nothing.
  async calculatePlatformFee(amount, currency = FLOOR_CURRENCY) {
    const settings = await this.getSettings();
    return this.computeFee(amount, currency, settings);
  }

  // Pure version (no database access) so it can be tested and reused.
  // Works in minor units (pesewas / cents) to avoid floating-point drift.
  computeFee(amount, currency, settings) {
    const total = Number(amount);
    if (!Number.isFinite(total) || total <= 0) return 0;

    const totalMinor = Math.round(total * 100);
    const percent = Number(settings?.platformFee) || 0;
    const floor = String(currency || '').toUpperCase() === FLOOR_CURRENCY
      ? (Number(settings?.platformFeeFloor) || 0)
      : 0;

    const percentFee = Math.round(totalMinor * percent / 100);
    const floorFee = Math.round(floor * 100);

    // never charge more than the order is worth
    const fee = Math.min(totalMinor, Math.max(percentFee, floorFee));
    return fee / 100;
  }

  // Splits an amount across tickets so the parts add up exactly
  // (for example 1.00 over 3 tickets → 0.34, 0.33, 0.33).
  allocateFee(totalFee, count) {
    const n = Math.floor(Number(count));
    if (!(n >= 1)) return [];
    const minor = Math.round(Number(totalFee) * 100) || 0;
    const base = Math.floor(minor / n);
    const remainder = minor - base * n;
    return Array.from({ length: n }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100);
  }

  // Who pays for this event: the event's own choice if it has one,
  // otherwise the platform default.
  resolveFeePayer(event, settings) {
    if (FEE_PAYERS.includes(event?.feePaidBy)) return event.feePaidBy;
    if (FEE_PAYERS.includes(settings?.feePaidBy)) return settings.feePaidBy;
    return 'organizer';
  }

  // Everything both sides need to know about one order's money. `faceTotal`
  // is the ticket value after discounts (what the organizer priced).
  //   serviceFee   → the extra line the buyer sees (0 when the organizer pays)
  //   buyerTotal   → what the buyer is charged
  //   organizerNet → what the organizer keeps from this order
  async quoteOrder(faceTotal, event) {
    const settings = await this.getSettings();
    const face = round2(faceTotal);
    const feePaidBy = this.resolveFeePayer(event, settings);
    const fee = this.computeFee(face, event?.currency, settings);

    return {
      faceTotal: face,
      fee,
      feePaidBy,
      serviceFee: feePaidBy === 'buyer' ? fee : 0,
      buyerTotal: round2(face + (feePaidBy === 'buyer' ? fee : 0)),
      organizerNet: round2(face - (feePaidBy === 'organizer' ? fee : 0)),
    };
  }
}

module.exports = new SettingsService();
