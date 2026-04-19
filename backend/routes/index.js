const express = require('express');
const authRoutes = require('./auth');
const userRoutes = require('./users');
const eventRoutes = require('./events');
const ticketRoutes = require('./tickets');
const waitlistRoutes = require('./waitlists');
const payoutRoutes = require('./payouts');
const adminRoutes = require('./admin');
const userSettingsRoutes = require('./settings');
const notificationRoutes = require('./notifications');




const router = express.Router();

router.use(authRoutes);
router.use(userRoutes);
router.use(eventRoutes);
router.use(ticketRoutes);
router.use(waitlistRoutes);
router.use(payoutRoutes);
router.use(adminRoutes);
router.use( userSettingsRoutes);
router.use(notificationRoutes);

module.exports = router;
