const settingsService = require('../services/settingsService');

exports.getSettings = async (req, res, next) => {
  console.log('User:', req.user); // see what's there
  try {
    const settings = await settingsService.getSettings();
    res.json(settings);
  } catch (err) { next(err); }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const { platformFee } = req.body;
    if (platformFee === undefined) {
      return res.status(400).json({ error: 'platformFee is required' });
    }
    if (typeof platformFee !== 'number' || platformFee < 0 || platformFee > 50) {
      return res.status(400).json({ error: 'platformFee must be a number between 0 and 50' });
    }
    const settings = await settingsService.updateSettings({ platformFee });
    res.json(settings);
  } catch (err) {
    next(err);
  }
};
