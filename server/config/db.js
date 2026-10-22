// config/db.js
const mongoose = require('mongoose');
const { logger } = require('./logger');

// ── Connection event handlers ──
// Registered once at module load. These fire for POST-connect events only;
// the initial connect failure is thrown from mongoose.connect() and handled
// by the retry loop in connectDB.
mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error', { err: err.message });
});
mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const buildOptions = () => ({
  // Server selection: how long to try finding a reachable primary before
  // giving up on a query. 5s is fast enough to fail over quickly and long
  // enough to survive a brief Atlas failover.
  serverSelectionTimeoutMS: 5000,

  // Per-socket connect timeout. Different phase from server selection:
  // covers the TCP handshake after a server has been selected.
  connectTimeoutMS: 10000,

  // Abort any query that runs longer than this. Default is 0 (no timeout)
  // in some driver versions — a stalled MongoDB would hang the request
  // forever. 45s lets genuinely slow queries complete but terminates
  // truly stuck ones.
  socketTimeoutMS: 45000,

  // Connection pool. Mongoose default is 100. For a Node app with
  // sub-100ms queries, 20 is plenty and stays well within Atlas M0's
  // 500-connection budget even with 2-3 instances. Override via env if
  // you hit "connection pool exhausted" logs.
  maxPoolSize: Math.max(Number(process.env.MONGO_MAX_POOL) || 20, 5),
  minPoolSize: 2,
});

// Retry with exponential backoff — startup is the most fragile moment
// (container just spun up, network not ready, Mongo still booting, or an
// Atlas failover in progress). Total worst-case window: ~35s.
const connectDB = async (attempts = 5) => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI not set in environment');
  }

  const options = buildOptions();

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const conn = await mongoose.connect(uri, options);
      logger.info(`MongoDB connected: ${conn.connection.host}`);
      return conn;
    } catch (err) {
      const isLast = attempt === attempts;
      if (isLast) {
        logger.error('MongoDB connect failed after all retries', {
          attempts,
          err: err.message,
        });
        // Throw — let the caller (server.js) decide whether to exit, retry
        // a different way, or degrade gracefully. A config module should
        // never call process.exit().
        throw err;
      }
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      logger.warn(
        `MongoDB connect attempt ${attempt}/${attempts} failed, retrying in ${delay}ms`,
        { err: err.message }
      );
      await sleep(delay);
    }
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB disconnected successfully');
  } catch (err) {
    logger.error('Error disconnecting from MongoDB', { err: err.message });
  }
};

const getConnectionStatus = () =>
  ({ 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' }[
    mongoose.connection.readyState
    ] || 'unknown');

module.exports = { connectDB, disconnectDB, getConnectionStatus };
