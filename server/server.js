require('dotenv').config();

const fs = require('fs');
const path = require('path');
const app = require('./app');
const mongoose = require('mongoose');
const config = require('./config');
const { connectDB } = require('./config/db');
// const { connectRedis } = require('./config/redis');  // re-enable when Redis is wired up
const { logger } = require('./config/logger');

// ── Ensure required directories exist ──
// resolve() so the path is relative to the server dir, not process.cwd().
// (multer.js and logger.js also create their own dirs — this is redundant
// but ensures dataDir exists if some service needs it.)
[config.dataDir, config.uploadDir].forEach((dir) => {
  if (!dir) return;
  const resolved = path.isAbsolute(dir) ? dir : path.resolve(__dirname, dir);
  if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: true });
});

// ── Validate PORT before listen() ──
// app.listen(undefined) → random port; app.listen('abc') → Unix socket at ./abc.
// Both are silent footguns. Fail loud with a clear message.
const rawPort = process.env.PORT || config.port;
const PORT = Number(rawPort);
if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) {
  logger.error(`❌ Invalid PORT: "${rawPort}" — must be an integer between 1 and 65535`);
  process.exit(1);
}

let server = null;
let shuttingDown = false;

const startServer = async () => {
  try {
    await connectDB();
    logger.info('✅ Database connected');

    server = app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📡 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🌐 URL: http://localhost:${PORT}`);
      logger.info(`📦 Node ${process.version} | ${process.platform}`);
    });

    // Handle listen() errors explicitly — EADDRINUSE emits 'error' asynchronously,
    // and without this listener it becomes an uncaughtException (confusing logs).
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${PORT} is already in use`);
      } else {
        logger.error('❌ HTTP server error', { err: err.message, code: err.code });
      }
      process.exit(1);
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
    logger.error('❌ Force closing connections after 10s timeout');
    process.exit(1);
  }, 10000).unref();

  try {
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
        // Close idle keep-alive connections immediately — nothing to wait for.
        if (typeof server.closeIdleConnections === 'function') {
          server.closeIdleConnections();
        }
        // For active connections, give 5s to finish their current request,
        // then force-close. Keeps total shutdown under the 10s force-exit timer.
        setTimeout(() => {
          if (typeof server.closeAllConnections === 'function') {
            server.closeAllConnections();
          }
        }, 5000).unref();
      });
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

// ── Process event handlers ──

process.on('unhandledRejection', (reason) => {
  // Rejections are contained in a promise — process state is usually OK.
  // Graceful shutdown gives us a chance to clean up before exit.
  logger.error('💥 Unhandled Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  gracefulShutdown('unhandledRejection', 1);
});

process.on('uncaughtException', (error) => {
  // Cannot safely perform async work after an uncaught exception — the process
  // is in an undefined state. Log and hard-exit. Attempting graceful shutdown
  // here (server.close, DB close) can corrupt state further.
  logger.error('💥 Uncaught Exception — exiting immediately', {
    err: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

startServer();
