const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const config = require('./index');

const uploadPath = path.resolve(__dirname, '..', config.uploadDir);

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp' };

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  // Random name + extension from MIME type: never trust the client's filename
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${EXT[file.mimetype]}`),
});

const fileFilter = (req, file, cb) => {
  if (EXT[file.mimetype]) return cb(null, true);
  cb(Object.assign(new Error('Only JPEG, PNG, GIF or WebP images are allowed'), { statusCode: 400 }), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

const uploadSingle = (field = 'file') => upload.single(field);
const uploadMultiple = (field, max = 5) => upload.array(field, max);
const uploadFields = (fields) => upload.fields(fields);

module.exports = { upload, uploadSingle, uploadMultiple, uploadFields };
