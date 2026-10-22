// config/logger.js
const path = require('path');
const fs = require('fs');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const { combine, timestamp, errors, splat, json, colorize, printf } = winston.format;

const isProd = process.env.NODE_ENV === 'production';

// Resolve log directory relative to this file so the path is stable under
// pm2, systemd, docker, and any cwd. Create it eagerly — winston transports
// throw on construction if the parent directory is missing, which would
// crash the process on first deploy.
const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Validate LOG_LEVEL against Winston's known levels — an unrecognized value
// makes winston.createLogger throw at startup with a confusing message.
const VALID_LEVELS = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];
const envLevel = String(process.env.LOG_LEVEL || '').toLowerCase();
const level = VALID_LEVELS.includes(envLevel)
  ? envLevel
  : (isProd ? 'info' : 'debug');

const consoleFormat = combine(
  // Disable ANSI colors in production — stdout is captured by container
  // runtimes and log aggregators where escape codes corrupt parsing.
  ...(isProd ? [] : [colorize()]),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  splat(),
  printf(({ timestamp, level, message, stack, ...rest }) => {
    const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
    return `${timestamp} ${level}: ${stack || message}${extra}`;
  })
);

const fileFormat = combine(timestamp(), errors({ stack: true }), splat(), json());

const logger = winston.createLogger({
  level,
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    ...(isProd
      ? [
        new DailyRotateFile({
          filename: path.join(LOG_DIR, 'application-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          format: fileFormat,
        }),
        // Error-only log — use DailyRotateFile too, otherwise it grows
        // unbounded in a single file. 30-day retention (vs. 14 for general
        // logs) keeps error history for postmortems.
        new DailyRotateFile({
          filename: path.join(LOG_DIR, 'error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxSize: '20m',
          maxFiles: '30d',
          format: fileFormat,
        }),
      ]
      : []),
  ],
});

module.exports = { logger };
