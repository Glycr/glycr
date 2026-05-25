const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const auth = require('../middleware/auth');

router.post('/email/send', auth, notificationController.sendEmail);
router.post('/sms/send', auth, notificationController.sendSMS);

module.exports = router;
