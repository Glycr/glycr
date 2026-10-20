// utils/AppError.js

// ============================================================
// 1. CUSTOM ERROR CLASS
//    Extends native Error to add HTTP status codes
//    Distinguishes between operational errors and programming bugs
// ============================================================
class AppError extends Error {
  /**
   * Create a new AppError
   * @param {string} message - Error message to display
   * @param {number} statusCode - HTTP status code (400, 401, 403, 404, 500, etc.)
   * @param {boolean} isOperational - Is this an expected error? (default: true)
   */
  constructor(message, statusCode, isOperational = true) {
    // --- Call parent Error constructor ---
    super(message);

    // --- Set custom properties ---
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = isOperational;

    // --- Capture stack trace (excludes this constructor) ---
    Error.captureStackTrace(this, this.constructor);
  }
}

// ============================================================
// 2. COMMON ERROR HELPERS (Optional convenience)
// ============================================================

/**
 * Create a 400 Bad Request error
 */
const badRequest = (message = 'Bad request') => {
  return new AppError(message, 400);
};

/**
 * Create a 401 Unauthorized error
 */
const unauthorized = (message = 'Unauthorized') => {
  return new AppError(message, 401);
};

/**
 * Create a 403 Forbidden error
 */
const forbidden = (message = 'Forbidden') => {
  return new AppError(message, 403);
};

/**
 * Create a 404 Not Found error
 */
const notFound = (message = 'Resource not found') => {
  return new AppError(message, 404);
};

/**
 * Create a 409 Conflict error
 */
const conflict = (message = 'Resource already exists') => {
  return new AppError(message, 409);
};

// ============================================================
// 3. EXPORT
// ============================================================
module.exports = {
  AppError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
};
