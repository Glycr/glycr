const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(helmet());
app.use(cors()); // keep your existing CORS
app.use(express.json());
app.use(morgan('combined'));

// Serve static files with CORP header to allow cross-origin loading
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, config.uploadDir)));

// API routes

app.use('/api', routes);
app.use(errorHandler);

module.exports = app;
