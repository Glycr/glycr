

const helmet = require('helmet');

// This server returns JSON and serves /uploads only, so the CSP can be strict.
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", 'data:', 'https:'],
    },

    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for inline scripts (be cautious)
        "http://localhost:63342",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
      ],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "http://localhost:63342"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // For inline styles (e.g., Bootstrap, custom)
        "https://fonts.googleapis.com",
        "https://cdn.jsdelivr.net",
      ],
      fontSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // lets other origins load /uploads images
};

module.exports = helmet(helmetConfig);
