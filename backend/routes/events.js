const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const auth = require('../middleware/auth');
const { validate, eventSchema } = require('../middleware/validation');


// Base path: /events
router.get('/events', eventController.getEvents);
router.get('/events/:id', eventController.getEvent);
router.post('/events', auth, validate(eventSchema), eventController.createEvent);
router.put('/events/:id', auth, validate(eventSchema), eventController.updateEvent);
router.put('/:id', auth, validate(eventSchema), eventController.updateEvent);
router.delete('/events/:id', auth, eventController.deleteEvent);
router.patch('/events/:id/publish', auth, eventController.togglePublish);
router.patch('/events/:id/cancel', auth, eventController.cancelEvent);
router.patch('/events/:id/flag', auth, eventController.flagEvent);
router.patch('/events/:id/unflag', auth, eventController.unflagEvent);

module.exports = router;
