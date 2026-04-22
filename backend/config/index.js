require('dotenv').config();

module.exports = {
  port: process.env.PORT,
  jwtSecret: process.env.JWT_SECRET,
  uploadDir: process.env.UPLOAD_DIR || 'uploads/',
  dataDir: process.env.DATA_DIR || 'data/',
};
