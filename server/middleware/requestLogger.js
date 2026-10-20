// middleware/requestLogger.js
const { logger } = require('../config/logger');

// ============================================================
// 1. REQUEST LOGGER MIDDLEWARE
//    Logs all incoming HTTP requests with status and duration
//    Must be placed BEFORE routes to log everything
// ============================================================
const requestLogger = (req, res, next) => {
  const start = Date.now();

  // --- Listen for when the response finishes ---
  res.on('finish', () => {
    // --- Calculate request duration ---
    const duration = Date.now() - start;

    // --- Extract request details ---
    const statusCode = res.statusCode;
    const method = req.method;
    const url = req.originalUrl || req.url;
    const ip = req.ip || req.connection?.remoteAddress;

    // --- Choose log level based on status code ---
    let logFn = logger.info; // Default: 200-399
    if (statusCode >= 500) logFn = logger.error; // Server errors
    else if (statusCode >= 400) logFn = logger.warn; // Client errors
    else if (statusCode >= 300) logFn = logger.http; // Redirects

    // --- Log the request ---
    logFn(`[${method}] ${url} - ${statusCode} - ${duration}ms - ${ip}`);
  });

  // --- Proceed to next middleware ---
  next();
};

// ============================================================
// 2. HELPER: Get client IP address
//    Handles proxy headers for accurate IP detection
// ============================================================
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.ip ||
    req.connection?.remoteAddress ||
    'unknown';
};

// ============================================================
// 3. ADVANCED: Request logger with body redaction (Optional)
//    Logs request body without sensitive data
// ============================================================
const requestLoggerWithBody = (req, res, next) => {
  const start = Date.now();
  const method = req.method;
  const url = req.originalUrl || req.url;

  // --- Log request start for debugging ---
  if (process.env.NODE_ENV === 'development') {
    logger.debug(`➡️ ${method} ${url} - Request started`);
  }

  // --- Listen for response ---
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    // --- Log with status ---
    let logFn = logger.info;
    if (statusCode >= 500) logFn = logger.error;
    else if (statusCode >= 400) logFn = logger.warn;

    // --- Include user agent for debugging ---
    const userAgent = req.headers['user-agent'] || 'unknown';

    logFn(`[${method}] ${url} - ${statusCode} - ${duration}ms - ${userAgent}`);
  });

  next();
};

// ============================================================
// 4. EXPORT
// ============================================================
module.exports = {
  requestLogger,
  getClientIp,
  requestLoggerWithBody,
};
