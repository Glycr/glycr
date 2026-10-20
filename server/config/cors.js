const { logger } = require('./logger');

// ============================================================
// 1. ALLOWED ORIGINS
//    (Comma-separated list from environment variables)
// ============================================================
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [ "https://wrytix.netlify.app"];

// ============================================================
// 2. CORS CONFIGURATION
// ============================================================
const corsOptions = {
  // --- Origin Handling ---
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is allowed or if we're in development
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      // Log blocked origins for debugging
      logger.warn(`❌ CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },

  // --- Credentials (Allow cookies to be sent) ---
  credentials: true,

  // --- Preflight Response ---
  optionsSuccessStatus: 200,

  // --- Allowed HTTP Methods ---
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  // --- Allowed Headers ---
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control'],
};

// ============================================================
// 3. EXPORT
// ============================================================
module.exports = { corsOptions };
