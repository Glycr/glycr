const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');

// Base path: /settings (mounted in index.js)
router.get('/', settingsController.getSettings);   // was '/user/settings'

module.exports = router;
