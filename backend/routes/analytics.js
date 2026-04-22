const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const auth = require('../middleware/auth');

router.get('/analytics/sales-trend', auth, analyticsController.getSalesTrend);

module.exports = router;
