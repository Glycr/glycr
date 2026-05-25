const Settings = require('../models/Settings');

class SettingsService {
  async getSettings() {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({ platformFee: 3 });
    }
    return settings;
  }

  async updateSettings(updates) {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }
    Object.assign(settings, updates);
    settings.updatedAt = new Date();
    await settings.save();
    return settings;
  }
}

module.exports = new SettingsService();
