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

const AUDIO = new Map([
  ['audio/mpeg', '.mp3'],
  ['audio/mp3', '.mp3'],
  ['audio/ogg', '.ogg'],
  ['audio/wav', '.wav'],
  ['audio/x-wav', '.wav'],
  ['audio/mp4', '.m4a'],
  ['audio/x-m4a', '.m4a'],
  ['audio/webm', '.webm'],
]);

const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, AUDIO.has(file.mimetype)),
});

const VIDEO = new Map([
  ['video/mp4', '.mp4'],
  ['video/webm', '.webm'],
]);

/** Оюндун интро видеосу — кыска болушу керек, ошондуктан 25 МБ чейин */
export const VIDEO_MAX_BYTES = 25 * 1024 * 1024;

const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: VIDEO_MAX_BYTES },
  fileFilter: (_req, file, cb) => cb(null, VIDEO.has(file.mimetype)),
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

/** Аудио (музыкалык суроолор үчүн), 10 МБ чейин */
uploadsRouter.post('/audio', uploadAudio.single('audio'), async (req, res) => {
  if (!req.file) throw new AppError('INVALID_FILE');
  const id = crypto.randomUUID() + (AUDIO.get(req.file.mimetype) ?? '');
  await prisma.upload.create({ data: { id, mime: req.file.mimetype, data: new Uint8Array(req.file.buffer) } });
  res.status(201).json({ url: `/uploads/${id}` });
});

/** Интро видео (mp4/webm), 25 МБ чейин */
uploadsRouter.post('/video', uploadVideo.single('video'), async (req, res) => {
  if (!req.file) throw new AppError('INVALID_FILE');
  const id = crypto.randomUUID() + (VIDEO.get(req.file.mimetype) ?? '');
  await prisma.upload.create({ data: { id, mime: req.file.mimetype, data: new Uint8Array(req.file.buffer) } });
  res.status(201).json({ url: `/uploads/${id}` });
});

/** GET /uploads/:id — базадан сүрөттү, аудиону же видеону берүү (видео үчүн Range колдоосу менен) */
export const uploadsPublicRouter = Router();
uploadsPublicRouter.get('/:id', async (req, res, next) => {
  const file = await prisma.upload.findUnique({ where: { id: req.params.id } });
  if (!file) return next(); // эски дисктеги файл болушу мүмкүн
  const data = Buffer.from(file.data);
  res.setHeader('Content-Type', file.mime);
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  res.setHeader('Accept-Ranges', 'bytes');
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (range && (range[1] || range[2])) {
    const size = data.length;
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end || start >= size) {
      res.setHeader('Content-Range', `bytes */${size}`);
      return res.status(416).end();
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    return res.send(data.subarray(start, end + 1));
  }
  res.send(data);
});
