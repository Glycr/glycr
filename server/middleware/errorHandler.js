const { logger } = require('../config/logger');
const { AppError } = require('../utils/appError');

// Fields that must never reach the logs
const SENSITIVE = ['password', 'token', 'refreshToken', 'authorization', 'cardNumber', 'cvv'];

const sanitize = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const clean = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    clean[k] = SENSITIVE.includes(k.toLowerCase()) ? '[REDACTED]' : sanitize(v);
  }
  return clean;
};

// Translate common library errors into clean client errors
const normalizeError = (err) => {
  if (err instanceof AppError) return err;

  if (err.name === 'CastError') {
    return new AppError(`Invalid ${err.path}: ${err.value}`, 400);
  }
  if (err.name === 'ValidationError') {
    const msg = Object.values(err.errors).map((e) => e.message).join(', ');
    return new AppError(msg, 400);
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return new AppError(`Duplicate value for ${field}`, 409);
  }
  if (err.name === 'JsonWebTokenError') return new AppError('Invalid token', 401);
  if (err.name === 'TokenExpiredError') return new AppError('Token expired', 401);

  return err;
};

// 404 for unknown routes (mount after all routes, before errorHandler)
const notFound = (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
};

// Global error handler (must be the last middleware)
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const error = normalizeError(err);
  const isDev = process.env.NODE_ENV !== 'production';
  const statusCode = error.statusCode || error.status || 500;

  const logMessage = `[${req.method}] ${req.originalUrl} - ${statusCode} - ${error.message}`;
  const context = {
    ip: req.ip,
    user: req.user?.id || 'anonymous',
    url: req.originalUrl,
    method: req.method,
  };

  if (statusCode >= 500) {
    logger.error(logMessage, {
      ...context,
      stack: error.stack,
      body: sanitize(req.body),
    });
  } else {
    logger.warn(logMessage, context);
  }

  const message =
    statusCode >= 500 && !isDev
      ? 'Something went wrong. Please try again later.'
      : error.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(isDev && { stack: error.stack }),
  });
};

module.exports = { notFound, errorHandler, AppError };
