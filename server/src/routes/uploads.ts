import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { requireAdmin } from '../auth.js';
import { AppError } from '../types.js';
import { SERVER_ROOT } from '../config.js';

export const UPLOAD_DIR = path.join(SERVER_ROOT, 'uploads');

const ALLOWED = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, crypto.randomUUID() + (ALLOWED.get(file.mimetype) ?? '')),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED.has(file.mimetype)),
});

export const uploadsRouter = Router();
uploadsRouter.use(requireAdmin);

uploadsRouter.post('/image', upload.single('image'), (req, res) => {
  if (!req.file) throw new AppError('INVALID_FILE');
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});
