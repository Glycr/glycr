const userService = require('../services/userService');
const Favorite = require('../models/Favorite'); // we'll create this model

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
    res.json(user);
  } catch (err) {
    next(err);
  }
};

exports.suspendUser = async (req, res, next) => {
  try {
    const user = await userService.suspendUser(req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

exports.unsuspendUser = async (req, res, next) => {
  try {
    const user = await userService.unsuspendUser(req.params.id);
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
