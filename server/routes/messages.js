const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');

// ── Admin-only messaging ──
// Previous version used `require('../middleware/role')` (file doesn't exist →
// MODULE_NOT_FOUND at startup) and `roleMiddleware(['admin', 'moderator'])`,
// which let moderators through the route layer but was rejected by
// messageController's `if (!req.user?.isAdmin)` check → 403 from controller,
// confusing error trail.
//
// These endpoints aren't moderation tasks:
//   - GET /admin/messages        → reads private direct-message bodies (PII)
//   - POST /admin/messages       → sends arbitrary email/SMS via Resend/Twilio
//   - POST /admin/messages/broadcast → sends to the entire user base
//   - DELETE /admin/messages/:id → destroys the audit record of sent messages
// All require admin.

router.get(
  '/admin/messages',
  auth,
  requireAdmin,
  messageController.getAllMessages
);

router.post(
  '/admin/messages',
  auth,
  requireAdmin,
  messageController.createDirectMessage
);

router.post(
  '/admin/messages/broadcast',
  auth,
  requireAdmin,
  messageController.createBroadcast
);

router.delete(
  '/admin/messages/:id',
  auth,
  requireAdmin,
  messageController.deleteMessage
);

module.exports = router;
