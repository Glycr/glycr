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
const EDITABLE_FIELDS = [
  'platformFee',
  'refundDeadlineDays',
];

const validators = {
  platformFee: (v) => {
    // Aligned with schema: max 50 (a 100% platform fee is not a real config)
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 50) {
      throw new AppError('platformFee must be a number between 0 and 50', 400);
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
    return Settings.findOneAndUpdate(
      {},
      { $setOnInsert: { platformFee: 3 } },
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
}

module.exports = new SettingsService();
