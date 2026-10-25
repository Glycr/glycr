// config/cors.js
const { logger } = require('./logger');
const { AppError } = require('../utils/appError');

const isProd = process.env.NODE_ENV;

// Comma-separated list in .env, e.g. ALLOWED_ORIGINS=https://glycr.com,https://admin.glycr.com
// Normalize: strip whitespace AND trailing slashes. Browsers never send a
// trailing slash in the Origin header, so `https://x.com/` in .env would
// never match `Origin: https://x.com` — silently breaking every request.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

// "*" is a common env-var footgun: it looks like a wildcard, but it's just
// the literal string "*" and matches nothing. Fail loud in production rather
// than silently blocking all browser traffic.
if (allowedOrigins.includes('*')) {
  logger.error('ALLOWED_ORIGINS cannot contain "*" — list each origin explicitly');
  if (isProd) {
    process.exit(1);
  }
  // Dev: strip it so the rest of the list still works
  allowedOrigins.length = 0;
  allowedOrigins.push(...(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter((o) => o && o !== '*'));
}

if (isProd && allowedOrigins.length === 0) {
  logger.warn('ALLOWED_ORIGINS is empty in production: all browser origins will be blocked');
}

const corsOptions = {
  origin: (origin, callback) => {
    // No origin: mobile apps, scanner apps, curl, Postman. Browsers always
    // send Origin on cross-origin requests, so this branch never leaks
    // anything to a browser page — no Access-Control-Allow-Origin header
    // is emitted for these requests (cors package: `if (origin) headers.push(...)`).
    if (!origin) return callback(null, true);

    // Outside production, allow everything (dev convenience).
    if (!isProd || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') return callback(null, true);

    logger.warn(`CORS blocked origin: ${origin}`);
    // AppError instead of Error+.statusCode — consistent with every other
    // 4xx in the codebase, and still picked up correctly by errorHandler.
    callback(new AppError('Not allowed by CORS', 403));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control'],

  // Expose rate-limit headers so the frontend can read them via
  // response.headers.get('RateLimit-Remaining'). Without this, they're
  // present on the wire but invisible to JavaScript.
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'],

  // Cache the preflight response for 24 hours. Browsers cap this anyway
  // (Chrome: 2h, Firefox/Safari: 24h), but explicit maxAge means every
  // authenticated request after the first one skips the OPTIONS round-trip.
  // Cuts perceived latency on SPAs roughly in half.
  maxAge: 86400,
};

module.exports = { corsOptions };
