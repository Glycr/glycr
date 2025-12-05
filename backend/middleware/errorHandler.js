// ============================================
// FILE: middleware/errorHandler.js
// ============================================
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  if (err.code === 11000) {
    return res.status(400).json({ error: 'Duplicate entry' });
  }

  res.status(500).json({ error: 'Internal server error' });
};

module.exports = errorHandler;
