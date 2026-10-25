const featuredService = require('../services/featuredService');
const logService = require('../services/logService');

const ctx = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

exports.getFeatured = async (req, res, next) => {
  try {
    res.json(await featuredService.getFeaturedEvents());
  } catch (err) {
    next(err);
  }
};

exports.setFeatured = async (req, res, next) => {
  try {
    const event = await featuredService.setFeatured(req.params.id, req.body);
    logService.audit(
      req.user.email,
      event.isFeatured ? 'feature_event' : 'unfeature_event',
      req.params.id,
      { type: 'event', adminId: req.user.id, order: event.featuredOrder, ...ctx(req) }
    );
    res.json(event);
  } catch (err) {
    next(err);
  }
};
