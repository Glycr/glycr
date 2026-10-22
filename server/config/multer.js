// config/multer.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('./index');
const { AppError } = require('../utils/appError');

// Resolve upload dir the same way here as everywhere — from __dirname so it
// doesn't depend on process.cwd() (pm2 / systemd / docker all resolve
// differently). Create it eagerly: multer throws ENOENT on first upload
// if the directory doesn't exist, and server.js may resolve a different path
// if its cwd differs.
const uploadPath = path.resolve(__dirname, '..', config.uploadDir);
fs.mkdirSync(uploadPath, { recursive: true });

// Allowlist of MIME types → canonical extension.
// SVG is intentionally excluded: inline SVG can contain <script>, and browsers
// execute it when served as image/svg+xml. Adding it here would turn the
// upload endpoint into a stored-XSS vector.
const EXT = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/gif':  '.gif',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  // Random name + extension derived from the declared MIME type.
  // Never trust the client's original filename (path traversal) or its
  // extension (attacker controls it — a '.php' file declared as image/png
  // must be saved as '.png').
  filename: (req, file, cb) => {
    const ext = EXT[file.mimetype];
    if (!ext) {
      // Should not happen (fileFilter gates this), but if someone bypasses
      // fileFilter or the two files drift apart, fail closed rather than
      // saving without an extension (which express.static serves as
      // application/octet-stream — the attacker gets a download, not an image).
      return cb(new AppError('Unexpected MIME type reached storage', 400));
    }
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (EXT[file.mimetype]) return cb(null, true);
  // AppError instead of Error-with-statusCode — routes through errorHandler
  // with the standard { success: false, message } shape.
  cb(new AppError('Only JPEG, PNG, GIF or WebP images are allowed', 400), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

const uploadSingle = (field = 'file') => upload.single(field);
const uploadMultiple = (field, max = 5) => upload.array(field, max);
const uploadFields = (fields) => upload.fields(fields);

// ── Magic-byte validation (defense in depth) ──
// The MIME type from the request is client-controlled. This helper checks
// the actual file header to confirm the content matches the declared type.
// Callers: run this on req.file(s) after multer writes them; if it returns
// false, delete the file and throw AppError.
const MAGIC_SIGNATURES = {
  'image/jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
  'image/png':  [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
  'image/gif':  [Buffer.from('GIF87a'), Buffer.from('GIF89a')],
  // WebP: 'RIFF' at 0-3, 'WEBP' at 8-11 — special-cased below
  'image/webp': [Buffer.from('RIFF')],
};

const verifyMagicBytes = async (filePath, mimetype) => {
  const signatures = MAGIC_SIGNATURES[mimetype];
  if (!signatures) return false;

  const fh = await fs.promises.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(12);
    await fh.read(buf, 0, 12, 0);

    if (mimetype === 'image/webp') {
      return buf.slice(0, 4).equals(Buffer.from('RIFF'))
        && buf.slice(8, 12).equals(Buffer.from('WEBP'));
    }
    return signatures.some((sig) => buf.slice(0, sig.length).equals(sig));
  } finally {
    await fh.close();
  }
};

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadFields,
  verifyMagicBytes,
  uploadPath,
};
