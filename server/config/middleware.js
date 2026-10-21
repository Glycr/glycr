// config/middleware.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('./helmet');
const config = require('./index');
const { corsOptions } = require('./cors');
const { upload } = require('./multer');
const { requestLogger } = require('../middleware/requestLogger');
const { apiLimiter, authLimiter, resetLimiter } = require('../middleware/rateLimit');
const { ddosProtection,loginSlowDown } = require('../middleware/slowDown');



const setupMiddleware = (app) => {
  // Only behind a proxy/load balancer (Nginx, Render, Heroku...). Set TRUST_PROXY=1 in .env.
  // Without it, rate limiting sees the proxy's IP instead of the client's.
  const tp = process.env.TRUST_PROXY;
  if (tp !== undefined) {
    app.set('trust proxy', tp === 'true' ? true : Number(tp));
  }
  app.use(helmet);
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(requestLogger);

  // Uploads sit before the rate limiters so event images don't count against them
  app.use('/uploads', express.static(path.resolve(__dirname, '..', config.uploadDir)));

  // Rate limits (must come after express.json(): authLimiter and resetLimiter read req.body)
  // Adjust these paths to match your real auth routes.
  app.use('/api', ddosProtection, apiLimiter);


  // Do NOT mount routes or error handlers here
  return { upload };
};

module.exports = { setupMiddleware };
