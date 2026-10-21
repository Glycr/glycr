const settingsService = require('../services/settingsService');
const logService = require('../services/logService');

const ctx = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

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
    // Read the current value first so the entry shows what it changed from
    const before = await settingsService.getSettings();
    const settings = await settingsService.updateSettings({ platformFee });
    logService.audit(req.user.email, 'update_settings', 'platformFee', {
      type: 'system', adminId: req.user.id,
      previousPlatformFee: before?.platformFee, newPlatformFee: settings?.platformFee ?? platformFee, ...ctx(req),
    });
    res.json(settings);
  } catch (err) {
    next(err);
  }
};
