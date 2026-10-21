const { logger } = require('./logger');

const isProd = process.env.NODE_ENV === 'production';

// Comma-separated list in .env, e.g. ALLOWED_ORIGINS=https://glycr.com,https://admin.glycr.com
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (isProd && allowedOrigins.length === 0) {
  logger.warn('ALLOWED_ORIGINS is empty in production: all browser origins will be blocked');
}

const corsOptions = {
  origin: (origin, callback) => {
    // No origin: mobile apps, scanner apps, curl, Postman
    if (!origin) return callback(null, true);

    // Outside production, allow everything (same as your old cors())
    if (!isProd || allowedOrigins.includes(origin)) return callback(null, true);

    logger.warn(`CORS blocked origin: ${origin}`);
    const err = new Error('Not allowed by CORS');
    err.statusCode = 403; // otherwise errorHandler reports it as a 500
    callback(err);
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control'],
};

module.exports = { corsOptions };
