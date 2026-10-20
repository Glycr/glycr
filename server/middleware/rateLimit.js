// middleware/rateLimit.js
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit'); // Helper for IPv6 normalization

// ============================================================
// 1. HELPER: Get username from request body
//    Extracts email or username for key generation
// ============================================================
const getUsername = (req) => req.body?.email || req.body?.username || null;

// ============================================================
// 2. GLOBAL API LIMITER (Blocks scrapers)
//    Protects all routes from excessive traffic
// ============================================================
const apiLimiter = rateLimit({
  // --- Time Window ---
  windowMs: 15 * 60 * 1000, // 15 minutes

  // --- Request Limit ---
  // v7 uses 'limit' (formerly 'max')
  limit: process.env.NODE_ENV === 'production' ? 100 : 1000,

  // --- Headers ---
  standardHeaders: true, // Send standard RateLimit-* headers
  legacyHeaders: false,   // Disable X-RateLimit-* headers (cleaner)

  // --- Response ---
  message: { error: 'Too many requests. Please wait.' },

  // --- Skip Rules ---
  skip: (req) => req.path === '/health' || req.path === '/', // Never block health checks

  // --- FIX: IPv6‑safe keyGenerator ---
  // Using req.ip directly would cause each IPv6 address to be treated separately.
  // ipKeyGenerator() normalises IPv6 to /56 subnet → fair grouping.
  keyGenerator: (req) => {
    const ip = req.ip ?? req.socket?.remoteAddress;
    return ip ? ipKeyGenerator(ip) : 'unknown';
  },
});

// ============================================================
// 3. AUTH LIMITER (Blocks brute-force attacks)
//    Protects login/register endpoints from password guessing
// ============================================================
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,                 // 5 failures → hard block
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Successful logins don't count toward limit
  message: { error: 'Excessive login attempts. Try again later.' },

  // --- Key Generator (Username + IP for precision) ---
  // Also IPv6‑safe
  keyGenerator: (req) => {
    const user = getUsername(req) || 'anon';
    const ip = req.ip ?? req.socket?.remoteAddress;
    const normalizedIp = ip ? ipKeyGenerator(ip) : 'unknown';
    return `auth_${user}_${normalizedIp}`;
  },

  skip: (req) => !getUsername(req), // Ignore malformed requests
});

// ============================================================
// 4. RESET LIMITER (Protects email sending budget)
//    Prevents abuse of password reset endpoint
// ============================================================
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 3,                 // Only 3 reset attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many reset attempts. Wait an hour.' },

  // --- IPv6‑safe keyGenerator ---
  keyGenerator: (req) => {
    const user = getUsername(req) || 'anon';
    const ip = req.ip ?? req.socket?.remoteAddress;
    const normalizedIp = ip ? ipKeyGenerator(ip) : 'unknown';
    return `reset_${user}_${normalizedIp}`;
  },
});

// ============================================================
// 5. EXPORT
// ============================================================
module.exports = {
  apiLimiter,
  authLimiter,
  resetLimiter,
};
