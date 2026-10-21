const express = require('express');
const { setupMiddleware } = require('./config/middleware');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// 1. Pre-route middleware (helmet, cors, body parsing, request log, static, rate limits)
setupMiddleware(app);

// 2. Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// 3. Routes
app.use('/api', routes);

// 4. Error handlers: must be last
app.use(notFound);
app.use(errorHandler);

module.exports = app;
