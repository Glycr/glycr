const analyticsService = require('../services/analyticsService');
const { AppError } = require('../utils/appError');

exports.getSalesTrend = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      throw new AppError('Authentication required', 401);
    }

    // Pass raw `days` through — the service validates it and returns a specific
    // 400 for invalid input instead of silently defaulting to 7.
    const data = await analyticsService.getSalesTrend(req.user.id, req.query.days);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.getOrganizerSummary = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      throw new AppError('Authentication required', 401);
    }
    const data = await analyticsService.getOrganizerSummary(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};
