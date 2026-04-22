const slowDown = require('express-slow-down');

// Slows down after 2 failed attempts, max delay 30 seconds
const loginSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 2,            // allow 2 requests without slowing
  delayMs: (hits) => hits * 1000, // 1s, 2s, 3s... up to 30s
  maxDelayMs: 30000,        // max 30 seconds delay
  skipSuccessfulRequests: true, // reset delay on successful login
  keyGenerator: (req) => {
    // Use email if present, otherwise IP
    return req.body.email || req.ip;
  },
});

module.exports = { loginSlowDown };
