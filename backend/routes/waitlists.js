const express = require('express');
const router = express.Router();
const waitlistController = require('../controllers/waitlistController');
const auth = require('../middleware/auth');
const { validate, waitlistSchema } = require('../middleware/validation');

// Base path: /waitlists
router.post('/waitlists', validate(waitlistSchema), waitlistController.joinWaitlist); // public
router.get('/events/:eventId/waitlists/:ticketType', auth, waitlistController.getWaitlist);
router.post('/events/:eventId/waitlists/notify', auth, waitlistController.notifyWaitlist);

module.exports = router;
