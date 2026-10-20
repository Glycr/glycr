// config/middleware.js
const express = require('express');
const cors = require('cors');
const { ddosProtection,loginSlowDown } = require('../middleware/slowDown');
const { apiLimiter ,authLimiter} = require('../middleware/rateLimit');
const { corsOptions } = require('./cors');
const { upload } = require('./multer');
const { requestLogger } = require('../middleware/requestLogger');
const helmet = require('./helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const setupSession = require('./session');

const setupMiddleware = (app) => {
  app.set('trust proxy', 1);

  app.use(helmet);
  if (process.env.NODE_ENV === "production") {
    app.use((req, res, next) => {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
      next();
    });
  }

  app.use(cookieParser());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ✅ Session applied here (before routes)
  setupSession(app);

  app.use(requestLogger);

  // Rate limiter + DDoS (skip login)
  app.use((req, res, next) => {
    if (req.path.startsWith('/auth/login',)) return next();
    apiLimiter(req, res, () => {
      ddosProtection(req, res, next);
    });
  });

  // Optional root route (can stay)
  app.get("/", (req, res) => {
    res.send("Backend is running 🚀");
  });

  // ❌ Do NOT mount routes or error handlers here
  return { upload };
};

module.exports = { setupMiddleware };
