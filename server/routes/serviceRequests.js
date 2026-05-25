const express = require('express');
const router = express.Router();
const serviceRequestController = require('../controllers/serviceRequestController');
// Remove auth middleware – guests can submit
router.post('/service-requests', serviceRequestController.createRequest);
module.exports = router;
