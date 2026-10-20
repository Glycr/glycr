// config/db.js (or database.config.js, whichever server.js requires)
const mongoose = require('mongoose');
const { logger } = require('./logger');

// Register once, before connecting, so early errors are caught too
mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error', { err: err.message });
});
mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not set in environment');

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // fail fast if Mongo is unreachable
    });

    logger.info(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { err: error.message });
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting from MongoDB', { err: error.message });
  }
};

const getConnectionStatus = () =>
  ({ 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' }[
    mongoose.connection.readyState
    ] || 'unknown');

module.exports = { connectDB, disconnectDB, getConnectionStatus };
