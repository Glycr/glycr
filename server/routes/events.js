const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const auth = require('../middleware/auth');
const { requireOrganizerOnly, requireOrganizer } = require('../middleware/rbac');
const { validate, eventSchema } = require('../middleware/validation');

// ── Public: event browsing ──
// Event listings and detail pages are unauthenticated — anyone can browse.
router.get('/events', eventController.getEvents);
router.get('/events/:id', eventController.getEvent);

// ── Organizer-only: event management ──
// requireOrganizerOnly (organizer, not admin) on every mutation:
//   - Without it, a customer with a valid JWT could create a live event on
//     the platform (service only checks that organizerId is a User._id, not
//     that the caller has the organizer role).
//   - Admins manage events via /admin/events/* (delete, flag, unflag,
//     publish). If admins need to create/update events on behalf of
//     organizers, switch to `requireOrganizer` (organizer + admin) here.
//   - The service still enforces per-event ownership for update/delete/
//     publish/cancel — organizer A can't touch organizer B's event.

router.post(
  '/events',
  auth,
  requireOrganizerOnly,
  validate(eventSchema),
  eventController.createEvent
);

// NOTE: previously there was a second `router.put('/:id', ...)` line here.
// It was a wildcard route (mounted at /api, matched any single-segment PUT),
// never actually handled `PUT /api/events/:id` (2 segments), and would
// silently shadow any future `PUT /api/<single>` route. Removed.
router.put(
  '/events/:id',
  auth,
  requireOrganizerOnly,
  validate(eventSchema),
  eventController.updateEvent
);

router.delete(
  '/events/:id',
  auth,
  requireOrganizerOnly,
  eventController.deleteEvent
);

router.patch(
  '/events/:id/publish',
  auth,
  requireOrganizerOnly,
  eventController.togglePublish
);

router.patch('/events/:id/cancel', auth, requireOrganizer, eventController.cancelEvent);

module.exports = router;
