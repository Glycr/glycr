// config/multer.js
const multer = require('multer');

// ============================================================
// 1. STORAGE: Memory (for GridFS / Cloudinary)
//    Files are kept in memory as Buffer – suitable for
//    uploading to GridFS, Cloudinary, or S3.
// ============================================================
const storage = multer.memoryStorage();

// ============================================================
// 2. FILE FILTER (Field‑specific)
//    - avatar : only images (JPEG, PNG, GIF, WebP)
//    - pdf    : only application/pdf
//    - other  : deny (you can extend as needed)
// ============================================================
const fileFilter = (req, file, cb) => {
  const { fieldname } = file;

  // --- Allowed image MIME types ---
  const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  if (fieldname === 'avatar') {
    if (imageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Avatar must be an image (JPEG, PNG, GIF, or WebP)'), false);
    }
  } else if (fieldname === 'pdf') {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Document must be a PDF'), false);
    }
  } else {
    // For any other field, you can decide to allow or deny.
    // Here we deny by default – adjust if you need other fields.
    cb(new Error(`Unexpected field: ${fieldname}`), false);
  }
};

// ============================================================
// 3. UPLOAD INSTANCE
// ============================================================
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 5,                  // Max 5 files per request
  },
});

// ============================================================
// 4. HELPER MIDDLEWARE
//    Convenience wrappers for common upload scenarios
// ============================================================

/**
 * Upload a single file (field name: 'file' by default)
 * @param {string} fieldName - name of the field (default: 'file')
 */
const uploadSingle = (fieldName = 'file') => upload.single(fieldName);

/**
 * Upload multiple files under the same field
 * @param {string} fieldName - field name
 * @param {number} maxCount - max number of files (default: 5)
 */
const uploadMultiple = (fieldName, maxCount = 5) => upload.array(fieldName, maxCount);

/**
 * Upload files to multiple fields (e.g., avatar, pdf)
 * @param {Array} fields - array of { name, maxCount }
 */
const uploadFields = (fields) => upload.fields(fields);

// ============================================================
// 5. EXPORT
// ============================================================
module.exports = {
  upload,          // raw multer instance
  uploadSingle,
  uploadMultiple,
  uploadFields,
};
