// middleware/requestLogger.js
const { logger } = require('../config/logger');

const SLOW_MS = 1000;
const SENSITIVE_PARAMS = ['token', 'password', 'secret', 'code', 'key', 'auth'];

// Paths that would only add noise
const shouldSkip = (url) => url === '/health' || url.startsWith('/uploads');

// Strip secrets from query strings (reset tokens, API keys...) before they reach the log files
const safeUrl = (req) => {
  const raw = req.originalUrl || req.url;
  const i = raw.indexOf('?');
  if (i === -1) return raw;

  const params = new URLSearchParams(raw.slice(i + 1));
  for (const key of [...params.keys()]) {
    if (SENSITIVE_PARAMS.some((s) => key.toLowerCase().includes(s))) params.set(key, 'REDACTED');
  }
  return `${raw.slice(0, i)}?${params}`;
};

// Real client IP. With `trust proxy` set, req.ip already handles X-Forwarded-For safely.
const getClientIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

const requestLogger = (req, res, next) => {
  const url = safeUrl(req);
  if (shouldSkip(req.originalUrl || req.url)) return next();

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
      `[${req.method}] ${url} - ${status} - ${duration}ms${slow} - ${getClientIp(req)} - user:${user}`
    );
  });

  // Client disconnected before a response was sent (dropped connection, cancelled request)
  res.on('close', () => {
    if (finished) return;
    logger.warn(
      `[${req.method}] ${url} - aborted after ${Date.now() - start}ms - ${getClientIp(req)}`
    );
  });

  next();
};

module.exports = { requestLogger, getClientIp };
