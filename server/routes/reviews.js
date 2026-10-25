const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const reviewController = require('../controllers/reviewController');

router.get('/reviews/my', auth, reviewController.getMyReviews);
router.post('/reviews',   auth, reviewController.createReview);

module.exports = router;
