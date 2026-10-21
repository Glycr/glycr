const userService = require('../services/userService');
const logService = require('../services/logService');
const Favorite = require('../models/Favorite'); // we'll create this model

const ctx = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

exports.getUsers = async (req, res, next) => {
  try {
    res.json([]);
  } catch (err) {
    next(err);
  }
};

exports.getUser = async (req, res, next) => {
  try {
    const user = await userService.getProfile(req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const user = await userService.updateProfile(req.params.id, req.body);
    // Field names only, never values
    const submittedFields = Object.keys(req.body || {}).filter((k) => k !== 'password');
    logService.audit(req.user.email, 'update_user', user?.email || req.params.id, {
      type: 'user', adminId: req.user.id, targetRole: user?.role, submittedFields, ...ctx(req),
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

exports.suspendUser = async (req, res, next) => {
  try {
    const user = await userService.suspendUser(req.params.id);
    logService.audit(req.user.email, 'suspend_user', user?.email || req.params.id, {
      type: 'user', adminId: req.user.id, targetRole: user?.role, ...ctx(req),
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

exports.unsuspendUser = async (req, res, next) => {
  try {
    const user = await userService.unsuspendUser(req.params.id);
    logService.audit(req.user.email, 'unsuspend_user', user?.email || req.params.id, {
      type: 'user', adminId: req.user.id, targetRole: user?.role, ...ctx(req),
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// NEW: Toggle favorite
exports.toggleFavorite = async (req, res, next) => {
  try {
    const { eventId, action } = req.body;
    const userId = req.user.id;
    if (action === 'add') {
      await Favorite.findOneAndUpdate(
        { userId, eventId },
        { userId, eventId },
        { upsert: true, new: true }
      );
    } else if (action === 'remove') {
      await Favorite.findOneAndDelete({ userId, eventId });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
