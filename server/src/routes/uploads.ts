import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { requireAdmin } from '../auth.js';
import { prisma } from '../db.js';
import { AppError } from '../types.js';
import { SERVER_ROOT } from '../config.js';

/** Эски версияда дискке сакталган сүрөттөр үчүн (артка шайкештик) */
export const UPLOAD_DIR = path.join(SERVER_ROOT, 'uploads');

const ALLOWED = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED.has(file.mimetype)),
});

export const uploadsRouter = Router();
uploadsRouter.use(requireAdmin);

/** Сүрөт базага сакталат — сервер кайра иштетилгенде да жоголбойт */
uploadsRouter.post('/image', upload.single('image'), async (req, res) => {
  if (!req.file) throw new AppError('INVALID_FILE');
  const id = crypto.randomUUID() + (ALLOWED.get(req.file.mimetype) ?? '');
  await prisma.upload.create({ data: { id, mime: req.file.mimetype, data: new Uint8Array(req.file.buffer) } });
  res.status(201).json({ url: `/uploads/${id}` });
});

/** GET /uploads/:id — базадан сүрөттү берүү */
export const uploadsPublicRouter = Router();
uploadsPublicRouter.get('/:id', async (req, res, next) => {
  const file = await prisma.upload.findUnique({ where: { id: req.params.id } });
  if (!file) return next(); // эски дисктеги файл болушу мүмкүн
  res.setHeader('Content-Type', file.mime);
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  res.send(Buffer.from(file.data));
});
