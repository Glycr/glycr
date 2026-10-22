const express          = require('express');
const router           = express.Router();
const auth             = require('../middleware/auth');
const staffController  = require('../controllers/staffController');
const { authLimiter }  = require('../middleware/rateLimit');
const { requireOrganizerOnly } = require('../middleware/rbac');

// ── Public: PIN login ──
// authLimiter is critical here. staffService.pinLogin runs bcrypt.compare
// against every active staff member (up to 500), so a wrong PIN can take
// 10-50 seconds of event-loop time. Without rate limiting:
//   - DoS: 10 concurrent requests saturate the event loop for 100s+
//   - Brute-force: a 4-digit PIN is 10,000 combinations, trivially enumerable
// authLimiter's keyGenerator reads req.body.email — pin-login has no email,
// so the key falls to `auth_anon_${ip}`. That's the right behavior here:
// it means "5 wrong PINs from this IP per 15 min", which is exactly the
// policy we want (per-IP, not per-staffId, since we don't know who they are).
router.post('/staff/pin-login', authLimiter, staffController.pinLogin);

// ── Staff CRUD (organizer-only) ──
// requireOrganizerOnly = organizers only (excludes admin). Admins have no
// business managing a specific organizer's staff — they'd get a clean 403
// from the route layer instead of a confusing 403 from the service.
//
// Staff themselves are also blocked: a staff token (type: 'staff') doesn't
// have role: 'organizer', so requireOrganizerOnly rejects them at the route.
router.post  ('/staff',              auth, requireOrganizerOnly, staffController.createStaff);
router.get   ('/staff',              auth, requireOrganizerOnly, staffController.listStaff);
router.get   ('/staff/:id',          auth, requireOrganizerOnly, staffController.getStaff);
router.patch ('/staff/:id/status',   auth, requireOrganizerOnly, staffController.setStatus);
router.delete('/staff/:id',          auth, requireOrganizerOnly, staffController.deleteStaff);

// ── Scanning endpoints live in routes/tickets.js ──
// PATCH /tickets/:ticketId/validate  → staffController.validateTicket
// GET   /tickets/validations         → staffController.getScanLogs
// GET   /tickets/checkin-stats       → staffController.getCheckinStats
// GET   /tickets/search              → staffController.searchTickets
//
// Mounting them under /staff/scan/* would be cleaner conceptually, but the
// frontend already calls the /tickets/* paths (from app.js) and the routes
// work — leave them there. Do NOT re-add to this file; it would create
// duplicate route handlers.

module.exports = router;
