// middleware/slowDown.js
const slowDowns = require('express-slow-down');
const { ipKeyGenerator } = require('express-rate-limit'); // ✅ official helper
const { logger } = require('../config/logger');

const ddosProtection = slowDowns({
  windowMs: 15 * 60 * 1000,
  delayAfter: 100,
  delayMs: (hits) => (hits - 100) * 100,
  maxDelayMs: 1000,
  skip: (req) => req.path.startsWith('/static') || req.path === '/health',
  message: 'Too fast! Slow down please.',
  // ✅ Use ipKeyGenerator
  keyGenerator: (req) => {
    const ip = req.ip ?? req.socket?.remoteAddress;
    return ip ? ipKeyGenerator(ip) : 'unknown';
  },
});

const loginSlowDown = slowDowns({
  windowMs: 15 * 60 * 1000,
  delayAfter: 2,
  delayMs: (hits) => hits * 1000,
  maxDelayMs: 30000,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const user = req.body?.email || req.body?.username || 'unknown';
    const ip = req.ip ?? req.socket?.remoteAddress;
    const normalizedIp = ip ? ipKeyGenerator(ip) : 'unknown';
    return `loginSlow_${user}_${normalizedIp}`;
  },
});

module.exports = { ddosProtection, loginSlowDown };
