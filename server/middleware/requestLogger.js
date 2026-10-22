// middleware/requestLogger.js
const crypto = require('crypto');
const { logger } = require('../config/logger');

const SLOW_MS = 1000;
const MAX_URL_LEN = 500;

// Query params that should always be redacted when they match exactly.
// "code" is intentionally excluded — countryCode, discountCode, and postalCode
// are legitimate non-secret params that would otherwise be over-redacted.
const SENSITIVE_EXACT = [
  'token', 'password', 'secret', 'key', 'auth',
  'apikey', 'api_key', 'accesstoken', 'refreshtoken',
  'resetcode', 'verificationcode', 'otpcode', 'otp', 'pin',
];

// Substring matches that indicate a field is probably sensitive regardless of
// prefix/suffix (e.g. newPassword, refreshToken, clientSecret).
const SENSITIVE_SUBSTR = ['password', 'token', 'secret', 'apikey'];

const isSensitiveParam = (key) => {
  const k = String(key).toLowerCase();
  return SENSITIVE_EXACT.includes(k) || SENSITIVE_SUBSTR.some((s) => k.includes(s));
};

// Paths/methods that would only add noise.
// OPTIONS skipped because every CORS preflight fires one — halving log volume
// without losing any real request tracking.
const shouldSkip = (req) =>
  req.method === 'OPTIONS' ||
  req.originalUrl === '/health' ||
  (req.originalUrl || '').startsWith('/uploads');

// Strip secrets from query strings before they reach the log files, and cap
// total URL length so a 10 MB `?q=...` doesn't bloat the log file.
const safeUrl = (req) => {
  const raw = req.originalUrl || req.url || '';
  const i = raw.indexOf('?');
  if (i === -1) {
    return raw.length > MAX_URL_LEN ? raw.slice(0, MAX_URL_LEN) + '…' : raw;
  }

  const path = raw.slice(0, i);
  const params = new URLSearchParams(raw.slice(i + 1));
  for (const key of [...params.keys()]) {
    if (isSensitiveParam(key)) params.set(key, 'REDACTED');
  }
  const result = `${path}?${params}`;
  return result.length > MAX_URL_LEN ? result.slice(0, MAX_URL_LEN) + '…' : result;
};

// Real client IP. With `trust proxy` set, req.ip already handles X-Forwarded-For safely.
const getClientIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

const requestLogger = (req, res, next) => {
  // Short request ID for correlation across logs. `errorHandler` can include
  // this in its log context so 4xx/5xx errors are linkable to the request line.
  const requestId = crypto.randomUUID().slice(0, 8);
  req.requestId = requestId;

  if (shouldSkip(req)) return next();

  const url = safeUrl(req);
  const start = Date.now();
  let finished = false;

  res.on('finish', () => {
    finished = true;
    const duration = Date.now() - start;
    const status = res.statusCode;

    let level = 'info';
    if (status >= 500) level = 'error';
    else if (status >= 400) level = 'warn';
    else if (duration > SLOW_MS) level = 'warn';

    // req.user is set by the auth middleware, so it's available by the time the response finishes
    const user = req.user?.id || 'anonymous';
    const slow = duration > SLOW_MS ? ' SLOW' : '';

    logger.log(
      level,
      `[${requestId}] [${req.method}] ${url} - ${status} - ${duration}ms${slow} - ${getClientIp(req)} - user:${user}`
    );
  });

  // Client disconnected before a response was sent (dropped connection, cancelled request)
  res.on('close', () => {
    if (finished) return;
    logger.warn(
      `[${requestId}] [${req.method}] ${url} - aborted after ${Date.now() - start}ms - ${getClientIp(req)}`
    );
  });

  next();
};

module.exports = { requestLogger, getClientIp };
