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
const analyticsRoutes = require('./analytics');
const refundRoutes = require('./refunds');





const router = express.Router();

router.use(authRoutes);
router.use(userRoutes);
router.use(eventRoutes);
router.use(ticketRoutes);
router.use(waitlistRoutes);
router.use(payoutRoutes);
router.use( userSettingsRoutes);
router.use(notificationRoutes);
router.use(analyticsRoutes);
router.use(refundRoutes);
router.use(adminRoutes);


module.exports = router;
