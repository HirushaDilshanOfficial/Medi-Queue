const fs = require('fs');
const path = require('path');
const multer = require('multer');

const REPORT_UPLOAD_DIR = path.join(__dirname, '..', 'private-uploads', 'reports');
fs.mkdirSync(REPORT_UPLOAD_DIR, { recursive: true });

const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

const reportUpload = multer({
  dest: REPORT_UPLOAD_DIR,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      const error = new Error('Only PDF, JPEG, PNG, and WebP reports are supported.');
      error.statusCode = 400;
      callback(error);
      return;
    }
    callback(null, true);
  },
});

module.exports = { reportUpload, REPORT_UPLOAD_DIR, allowedTypes };
