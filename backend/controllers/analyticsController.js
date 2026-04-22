const analyticsService = require('../services/analyticsService');

exports.getSalesTrend = async (req, res, next) => {
  try {
    const organizerId = req.user.id;
    const days = parseInt(req.query.days) || 7;
    const data = await analyticsService.getSalesTrend(organizerId, days);
    res.json(data);
  } catch (err) {
    next(err);
  }
};
