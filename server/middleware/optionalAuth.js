// middleware/optionalAuth.js
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const Staff = require('../models/Staff');

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

// Optional authentication: allows guests through, but if a valid token is
// present, verifies it with the SAME checks as middleware/auth.js (suspended,
// passwordChangedAt, staff status, ObjectId guard). This is required to avoid
// a suspended user bypassing the block by using an endpoint that only does
// "optional" auth.
//
// Behavior:
//   - No token                    → req.user = null (guest flow)
//   - Invalid/expired token       → req.user = null (guest flow — safe)
//   - Valid token, user suspended → 401 (reject — can't pretend to be guest
//                                    to bypass suspension)
//   - Valid token, password reset → 401 (session expired)
//   - Valid token, staff inactive → 401 (staff deactivated)
//   - Valid user token, OK        → req.user = decoded
//   - Valid staff token, OK       → req.user = null (staff purchases act as
//                                    guest — their token is not a User identity)
module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      req.user = null;
      return next();
    }

    // Match the strict header format used by middleware/auth.js
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || !/^Bearer$/i.test(parts[0]) || !parts[1]) {
      req.user = null;
      return next();
    }

    let decoded;
    try {
      decoded = jwt.verify(parts[1], config.jwtSecret);
    } catch {
      // Invalid/expired token — treat as guest. Do not 401 (that would break
      // the "optional" contract for endpoints where guests are allowed).
      req.user = null;
      return next();
    }

    if (!OBJECT_ID.test(String(decoded.id || ''))) {
      req.user = null;
      return next();
    }

    if (decoded.type === 'staff') {
      const staff = await Staff.findById(decoded.id).select('status').lean();
      if (!staff || staff.status !== 'active') {
        // Staff deactivated between token issuance and now — reject, don't
        // silently downgrade to guest (that would let a deactivated staff
        // keep acting with their old token).
        return res.status(401).json({
          success: false,
          message: 'Staff account is inactive',
        });
      }
      // Staff token is valid but is not a User identity. The purchase route
      // expects a User._id. Treat staff as guest so tickets aren't attributed
      // to a Staff document.
      req.user = null;
      return next();
    }

    const user = await User.findById(decoded.id)
      .select('suspended passwordChangedAt')
      .lean();
    if (!user) {
      req.user = null;
      return next();
    }
    if (user.suspended) {
      return res.status(401).json({ success: false, message: 'Account suspended' });
    }
    if (
      user.passwordChangedAt &&
      decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)
    ) {
      return res.status(401).json({
        success: false,
        message: 'Session expired — please log in again',
      });
    }

    req.user = decoded;
    next();
  } catch (err) {
    next(err);
  }
};
