const slowDown = require('express-slow-down');
const { ipKeyGenerator } = require('express-rate-limit');

const loginSlowDown = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 2,
  delayMs: (hits) => hits * 1000,
  maxDelayMs: 30000,
  skipSuccessfulRequests: true,
  // Use the official helper for correct IPv4/IPv6 handling
  keyGenerator: (req) => ipKeyGenerator(req.ip),
});

module.exports = { loginSlowDown };
