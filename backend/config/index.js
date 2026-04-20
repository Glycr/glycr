require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5010,
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  uploadDir: process.env.UPLOAD_DIR || 'uploads/',
  dataDir: process.env.DATA_DIR || 'data/',
};
