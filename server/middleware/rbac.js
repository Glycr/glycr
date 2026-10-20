const { logger } = require('../config/logger');
const logService = require('../services/logService');

// Works with session auth or JWT auth (req.user set by your auth middleware)
const getUser = (req) => req.session?.user || req.user || null;

const deny = (res, status, message) => res.status(status).json({ error: message });

// Authenticated user hit something forbidden: MongoDB + winston via logService.
// Not awaited so it can't delay the 403. audit() catches its own errors.
const auditDenied = (req, user, action) => {
  logService.audit(
    user.username || user.email || String(user.id || user._id),
    action,
    req.originalUrl,
    {
      type: 'warning',
      adminId: user.id || user._id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      role: user.role,
      method: req.method,
    }
  );
};

const requireLogin = (req, res, next) => {
  if (getUser(req)) return next();

  // Anonymous: winston files only, never MongoDB (prevents log flooding)
  logger.warn('Login required', {
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  return deny(res, 401, 'Login required');
};

const requireRole = (allowedRoles) => (req, res, next) => {
  const user = getUser(req);

  if (!user) {
    logger.warn('Unauthenticated access attempt', { path: req.originalUrl, ip: req.ip });
    return deny(res, 401, 'Unauthorized: not logged in');
  }

  if (!allowedRoles.includes(user.role)) {
    auditDenied(req, user, 'access-denied');
    return deny(res, 403, 'Forbidden: insufficient role');
  }

  next();
};

const requireAdmin = requireRole(['admin']);
const requireModeratorOrAdmin = requireRole(['moderator', 'admin']);
const requireOrganizer = requireRole(['organizer', 'admin']);
const requireOrganizerOrStaff = requireRole(['organizer', 'moderator', 'admin']);
const verifySession = requireLogin; // kept so existing imports don't break

module.exports = {
  verifySession,
  requireLogin,
  requireRole,
  requireAdmin,
  requireModeratorOrAdmin,
  requireOrganizer,
  requireOrganizerOrStaff,
};
