const express = require('express');
const authRoutes = require('./auth');
const eventRoutes = require('./event');
const ticketRoutes = require('./ticket');
const waitlistRoutes = require('./waitlist');
const payoutRoutes = require('./payout');
const favoriteRoutes = require('./favorite');
const adminRoutes = require('./admin');


const router = express.Router();





router.use(authRoutes);
router.use(eventRoutes);
router.use(adminRoutes);
router.use(ticketRoutes)
router.use(waitlistRoutes)
router.use(payoutRoutes)
router.use(favoriteRoutes)


module.exports = router;
