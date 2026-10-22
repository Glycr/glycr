// middleware/auth.js
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const Staff = require('../models/Staff');
const { AppError } = require('../utils/appError');

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new AppError('No token provided', 401);
    }

    // Require exactly "Bearer <token>" — reject Basic/Digest/other schemes,
    // malformed headers, and missing tokens. Header parsing that accepts
    // `authHeader.split(' ')[1]` blindly would accept "Basic abc123" as a
    // Bearer token, which is a protocol violation and a source of
    // hard-to-debug auth failures.
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || !/^Bearer$/i.test(parts[0]) || !parts[1]) {
      throw new AppError('Invalid authorization header', 401);
    }
    const token = parts[1];

    // jwt.verify throws JsonWebTokenError (invalid) or TokenExpiredError
    // (expired). errorHandler.normalizeError maps these to 401 with distinct
    // messages, so no manual catch is needed.
    const decoded = jwt.verify(token, config.jwtSecret);

    // Guard against a JWT_SECRET leak scenario where an attacker crafts a
    // token with a non-ObjectId `id`. Without this, Staff.findById throws a
    // CastError → errorHandler → 400 (wrong status for an auth failure).
    if (!OBJECT_ID.test(String(decoded.id || ''))) {
      throw new AppError('Invalid token', 401);
    }

    // ── Distinguish staff tokens from user tokens ──
    // userService.login signs:  { id: User._id, email, role, isOrganizer, isAdmin }
    // staffService.pinLogin signs: { id: Staff._id, staffId, organizerId, eventId, type: 'staff', role }
    // The `type: 'staff'` claim is the discriminator.
    if (decoded.type === 'staff') {
      const staff = await Staff.findById(decoded.id).select('status').lean();
      if (!staff) {
        throw new AppError('Staff account no longer exists', 401);
      }
      if (staff.status !== 'active') {
        throw new AppError('Staff account is inactive', 401);
      }
      // req.user keeps the staff claims (organizerId, eventId, staffId).
      // Controllers resolve the acting organizer via `req.user.organizerId`
      // for staff, `req.user.id` for organizers — see staffController.resolveActor.
    } else {
      const user = await User.findById(decoded.id)
        .select('suspended passwordChangedAt')
        .lean();
      if (!user) {
        throw new AppError('User no longer exists', 401);
      }
      if (user.suspended) {
        throw new AppError('Account suspended', 401);
      }
      // Reject tokens issued BEFORE the last password change — stolen tokens
      // die when the password resets, instead of surviving for up to 7 days.
      //
      // Comparison uses integer seconds because JWT `iat` is second-precision:
      // a new token issued in the same second the password changed has
      // `iat === floor(passwordChangedAt / 1000)` and MUST be allowed.
      // Using `iat * 1000 < passwordChangedAt.getTime()` would incorrectly
      // invalidate that fresh token.
      if (
        user.passwordChangedAt &&
        decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)
      ) {
        throw new AppError('Session expired — please log in again', 401);
      }
    }

    req.user = decoded;
    req.token = token;   // preserved for future "logout this token" endpoints
    next();
  } catch (err) {
    next(err);
  }
};
