require('dotenv').config();

const fs = require('fs');
const app = require('./app');
const mongoose = require('mongoose');
const config = require('./config');
const { connectDB } = require('./config/db');        // match your actual filename (see note below)
const { connectRedis } = require('./config/redis');  // remove with the Redis lines if you don't have it
const { logger } = require('./config/logger');

// Ensure required directories exist
[config.dataDir, config.uploadDir].forEach((dir) => {
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const PORT = process.env.PORT || config.port;
let server = null;
let shuttingDown = false;

const startServer = async () => {
  try {
    await connectDB();
    logger.info('✅ Database connected');

   // await connectRedis();
   // logger.info('✅ Redis connected');

    server = app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📡 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🌐 URL: http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server', { err: error.message, stack: error.stack });
    process.exit(1);
  }
};

const gracefulShutdown = async (signal, exitCode = 0) => {
  if (shuttingDown) return;   // ignore repeated signals
  shuttingDown = true;

  logger.warn(`⚠️ Received ${signal}, shutting down gracefully...`);

  // Force exit if shutdown hangs; unref so it doesn't keep the process alive
  setTimeout(() => {
    logger.error('❌ Force closing connections...');
    process.exit(1);
  }, 10000).unref();

  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      logger.info('✅ HTTP server closed');
    }
    await mongoose.connection.close();
    logger.info('✅ Database connection closed');
  } catch (err) {
    logger.error('❌ Error during shutdown', { err: err.message });
    exitCode = 1;
  }

  process.exit(exitCode);
};

// --- Process event handlers ---
process.on('unhandledRejection', (reason) => {
  logger.error('💥 Unhandled Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  gracefulShutdown('unhandledRejection', 1);
});

process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception', { err: error.message, stack: error.stack });
  gracefulShutdown('uncaughtException', 1);
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
