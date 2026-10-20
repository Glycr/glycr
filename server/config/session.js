// config/session.js
const session = require('express-session');
const RedisStore = require('connect-redis');   // ✅ no (session) wrapper // ✅ Redis store
const { getRedisClient } = require('./redis');   // import your client getter

const setupSession = (app) => {
  const redisClient = getRedisClient();
  if (!redisClient) {
    // Fallback to memory store (or throw error)
    console.warn('⚠️ Redis not available – using memory store (not suitable for production)');
    app.use(session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production' }
    }));
    return;
  }

  const sessionStore = new RedisStore({
    client: redisClient,
    ttl: 14 * 24 * 60 * 60,   // 14 days (in seconds)
    prefix: 'sess:',
  });

  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  }));
};

module.exports = setupSession;
