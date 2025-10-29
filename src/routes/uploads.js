/**
 * uploads.js - File upload routes
 * 
 * Provides endpoints for uploading files (e.g., avatar images) using multer.
 * Stores files to the local filesystem under 'uploads/avatars' and returns
 * a public URL that can be used by the frontend.
 */

import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Ensure upload directories exist
const UPLOAD_ROOT = path.resolve('uploads');
const AVATAR_DIR = path.join(UPLOAD_ROOT, 'avatars');

for (const dir of [UPLOAD_ROOT, AVATAR_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, AVATAR_DIR);
  },
  filename: function (_req, file, cb) {
    // Create a unique filename: timestamp-originalname sanitized
    const timestamp = Date.now();
    // Basic sanitization of filename
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${timestamp}-${safeOriginal}`);
  }
});

// File filter to allow only images
const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

// 5MB file size limit
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

/**
 * POST /api/uploads/avatar
 *
 * Accepts a single file field named 'image'. Returns { url } with the public URL
 * to the uploaded file.
 */
router.post('/avatar', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Build a public URL using the current host
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${req.file.filename}`;

    return res.status(201).json({ success: true, url: fileUrl });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ success: false, message: 'File upload failed' });
  }
});

export default router;
