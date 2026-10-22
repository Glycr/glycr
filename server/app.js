const express = require('express');
const { setupMiddleware } = require('./config/middleware');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// ── 1. Pre-route middleware ──
// Order matters: helmet → cors → requestLogger → body parsers → rate limiters.
// See config/middleware.js for the full chain.
setupMiddleware(app);

// ── 2. Health checks ──
// Mounted BEFORE routes so a broken route never blocks the health check.
// Both skip rate limiters (via prefix: they're mounted at /api, health is
// at the root, so `apiLimiter` never touches them).

// Liveness: is the process alive?
// MUST NOT check dependencies — a DB blip would otherwise cause k8s to
// restart the pod repeatedly, making the outage worse. Only the fact that
// we can respond is checked.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Readiness: can we serve real traffic?
// Checks DB connectivity. Returns 503 when the DB is down so k8s/load
// balancers stop routing traffic to this pod — but DOES NOT trigger a
// restart (that's liveness's job).
//
// ⚠️  If you're on Render/Heroku (single health-check path), leave the
// simple `/health` above and skip this endpoint. Those platforms use the
// same check for liveness and readiness, so a DB-aware response would
// cause restart loops during DB blips.
app.get('/health/ready', async (req, res) => {
  const mongoose = require('mongoose');
  const dbReady = mongoose.connection.readyState === 1;
  if (!dbReady) {
    return res.status(503).json({ status: 'not ready', db: 'disconnected' });
  }
  res.json({ status: 'ready', db: 'connected', timestamp: new Date().toISOString() });
});

// ── 3. Routes ──
app.use('/api', routes);

// ── 4. Error handlers (must be last) ──
// notFoundHandler catches every unmatched request and turns it into a 404 AppError;
// errorHandler normalizes every error (including that one) into { success: false, message }.
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
