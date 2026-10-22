// middleware/slowDown.js
const slowDowns = require('express-slow-down');
const { ipKeyGenerator } = require('express-rate-limit');
const { logger } = require('../config/logger');

// Real client IP — respects trust proxy via req.ip.
const clientIp = (req) => {
  const ip = req.ip ?? req.socket?.remoteAddress;
  return ip ? ipKeyGenerator(ip) : 'unknown';
};

// express-slow-down doesn't take a `handler`; it delays but still calls the
// downstream handler. To log a slowdown we wrap the limiter and measure the
// actual wall-clock difference between entering and leaving the middleware.
const withSlowdownLogging = (limiter, name) => (req, res, next) => {
  const start = Date.now();
  limiter(req, res, () => {
    const delayMs = Date.now() - start;
    if (delayMs > 100) {
      logger.warn('Slowdown applied', {
        limiter: name,
        delayMs,
        path: req.originalUrl,
        ip: req.ip,
      });
    }
    next();
  });
};

// ============================================================
// 1. GLOBAL SLOWDOWN — adds latency to reduce scraping pressure
//    Real DoS is blocked by apiLimiter; this only adds "cost".
// ============================================================
const ddosProtectionInner = slowDowns({
  windowMs: 15 * 60 * 1000,

  // First 100 requests in the window: no delay. Beyond that, latency
  // escalates fast and caps at 1s. Combined with apiLimiter (300/15min),
  // this makes scraping meaningfully expensive before the hard block fires.
  delayAfter: 100,
  delayMs: (hits) => (hits - 100) * 100,
  maxDelayMs: 1000,

  // Only /health is meaningful here — ddosProtection is mounted at /api,
  // so req.path is relative to /api. The /static check from the previous
  // version was dead code (no /api/static/* routes exist).
  skip: (req) => req.path === '/health',

  // NOTE: express-slow-down doesn't support `message` — it never responds,
  // it just delays. That option was dead config and has been removed.

  keyGenerator: (req) => clientIp(req),
});

const ddosProtection = withSlowdownLogging(ddosProtectionInner, 'ddos');

// ============================================================
// 2. LOGIN SLOWDOWN — delays brute-force attempts
//    Fires after 2 failed attempts on the same (identifier, IP) pair.
//    skipSuccessfulRequests: failed attempts accumulate, successful
//    logins decrement — the counter tracks recent failures only.
// ============================================================
const loginSlowDownInner = slowDowns({
  windowMs: 15 * 60 * 1000,
  delayAfter: 2,
  delayMs: (hits) => hits * 1000,
  maxDelayMs: 30000,
  skipSuccessfulRequests: true,

  // Malformed requests (no email/username) skip the limiter so the 400 from
  // Joi/service fires normally instead of being delayed behind a shared
  // "loginSlow_unknown_<ip>" bucket.
  skip: (req) => !(req.body?.email || req.body?.username),

  keyGenerator: (req) => {
    const user = req.body?.email || req.body?.username || 'unknown';
    return `loginSlow_${user}_${clientIp(req)}`;
  },
});

const loginSlowDown = withSlowdownLogging(loginSlowDownInner, 'login');

module.exports = { ddosProtection, loginSlowDown };
