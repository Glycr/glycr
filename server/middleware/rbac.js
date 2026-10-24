// middleware/rbac.js
const { logger } = require('../config/logger');
const logService = require('../services/logService');
const { AppError } = require('../utils/appError');

// Extract the acting principal from req.user (set by auth.js after JWT verify).
// - User tokens:  { id: User._id, email, role, isOrganizer, isAdmin }
// - Staff tokens: { id: Staff._id, staffId: 'S1234ABCD', organizerId: User._id,
//                   eventId, role: 'scanner'|'supervisor', type: 'staff' }
const getPrincipal = (req) => {
  const user = req.user;
  if (!user) return null;

  const isStaff = user.type === 'staff';
  return {
    user,
    isStaff,
    // Human-readable identity for logs. JWT has no `username`.
    // Staff have no `email` in the JWT — use the human-readable staffId code.
    actorName: isStaff
      ? (user.staffId || String(user.id))
      : (user.email || String(user.id)),
    // The User._id to attribute the action to (Log.adminId → ref: 'User').
    // For staff actions, attribute to the organizer who owns the staff account.
    // Without this, staff denials log a Staff._id into a User ref → populate fails.
    adminId: isStaff ? user.organizerId : user.id,
  };
};

// Build the error, audit if authenticated, and return it. Callers pass it to
// next() so errorHandler produces the standard { success: false, message }
// response and logs with requestId/ip/user context.
const denyWith = (req, status, message, principal, action) => {
  if (principal && principal.actorName) {
    // Authenticated but forbidden — audit the attempt. Fire-and-forget;
    // the .catch() prevents an audit-service rejection from crashing the
    // process as an unhandled rejection.
    logService.audit(principal.actorName, action || 'access-denied', req.originalUrl, {
      type: 'warning',
      adminId: principal.adminId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      role: principal.user.role,
      staffId: principal.isStaff ? principal.user.staffId : undefined,
      method: req.method,
    }).catch((err) => {
      logger.error('RBAC audit failed', { err: err.message, action, path: req.originalUrl });
    });
  } else {
    // Anonymous — winston only (prevents log flooding from unauthenticated probes).
    logger.warn('Unauthenticated access attempt', {
      path: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  }
  return new AppError(message, status);
};

const requireLogin = (req, res, next) => {
  if (req.user) return next();
  return next(denyWith(req, 401, 'Login required', null, null));
};

const requireRole = (allowedRoles, options = {}) => (req, res, next) => {
  const principal = getPrincipal(req);

  if (!principal) {
    return next(denyWith(req, 401, 'Unauthorized: not logged in', null, null));
  }

  // Staff-only endpoint (e.g. /staff/scan). Organizer/admin tokens are rejected.
  if (options.staffOnly) {
    if (!principal.isStaff) {
      return next(denyWith(req, 403, 'Forbidden: staff only', principal, 'access-denied'));
    }
    return next();
  }

  // Staff allowed alongside other roles. Used by requireOrganizerOrStaff below:
  // without this branch, staff tokens (role: scanner|supervisor) never match
  // the organizer/moderator/admin list and every staff call gets 403.
  if (options.allowStaff && principal.isStaff) {
    return next();
  }

  if (!allowedRoles.includes(principal.user.role)) {
    return next(denyWith(req, 403, 'Forbidden: insufficient role', principal, 'access-denied'));
  }

  next();
};

const requireAdmin               = requireRole(['admin']);
const requireModeratorOrAdmin    = requireRole(['moderator', 'admin']);
const requireOrganizer           = requireRole(['organizer', 'moderator', 'admin']);
// Organizer-only (excludes admin) — used for routes where an admin has no
// business acting on behalf of an organizer, e.g. per-organizer staff
// management. Admin gets a clean 403 at the route layer instead of the
// confusing "Event not found or not yours" from the service.
const requireOrganizerOnly       = requireRole(['organizer']);
const requireOrganizerOrStaff    = requireRole(['organizer', 'moderator', 'admin'], { allowStaff: true });
const requireStaff               = requireRole([], { staffOnly: true });
const verifySession              = requireLogin; // compat alias

module.exports = {
  verifySession,
  requireLogin,
  requireRole,
  requireAdmin,
  requireModeratorOrAdmin,
  requireOrganizer,
  requireOrganizerOnly,
  requireOrganizerOrStaff,
  requireStaff,
};
