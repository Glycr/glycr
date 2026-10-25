const reviewService = require('../services/reviewService');

exports.createReview = async (req, res, next) => {
  try {
    const review = await reviewService.createReview(req.user?.id, req.body);
    res.status(201).json(review);
  } catch (err) {
    next(err);
  }
};

exports.getMyReviews = async (req, res, next) => {
  try {
    res.json(await reviewService.getMyReviews(req.user?.id));
  } catch (err) {
    next(err);
  }
};
