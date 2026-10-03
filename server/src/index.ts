import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Server } from 'socket.io';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { SERVER_ROOT, config, getLanIp } from './config.js';
import { prisma } from './db.js';
import { AppError } from './types.js';
import { publicRouter } from './routes/public.js';
import { questionsRouter } from './routes/questions.js';
import { gamesRouter } from './routes/games.js';
import { uploadsRouter, UPLOAD_DIR } from './routes/uploads.js';
import { importExportRouter } from './routes/importExport.js';
import { setupSockets } from './sockets/index.js';
import { restoreTimers } from './game/engine.js';

const app = express();
// Render/nginx сыяктуу прокси артында чыныгы IP’ни алуу үчүн TRUST_PROXY=1 коюлат (PIN бөгөтү ар бир түзмөккө өзүнчө иштеши үчүн)
const trustProxy = process.env.TRUST_PROXY;
app.set('trust proxy', trustProxy ? (/^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === 'true') : 'loopback');
app.use(cors());
app.use(express.json({ limit: '2mb' }));

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});
app.use('/api', publicRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/games', gamesRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api', importExportRouter);

app.use('/api', (_req, _res) => {
  throw new AppError('NOT_FOUND', 404);
});

// Production: даяр client (client/dist) ушул эле сервер аркылуу берилет
const clientDist = path.resolve(SERVER_ROOT, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api|uploads|socket\.io).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Каталарды бирдиктүү форматта кайтарабыз: { error: 'КОД', details? }
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.code, details: err.details });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'BAD_REQUEST', details: err.flatten() });
    return;
  }
  if (err instanceof MulterError) {
    res.status(400).json({ error: 'INVALID_FILE', details: err.code });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'SERVER_ERROR' });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
setupSockets(io);
await restoreTimers();

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ✗ ${config.port}-порт бош эмес: сервер башка терезеде иштеп жаткан болушу мүмкүн.`);
    console.error('    Ал терезени жабыңыз же server/.env файлында PORT маанисин өзгөртүңүз.\n');
    process.exit(1);
  }
  throw err;
});

server.listen(config.port, '0.0.0.0', () => {
  const ip = getLanIp();
  console.log('\n  🏆 ТАПКЫЧ ОРДО сервери иштеп жатат');
  console.log(`  ➜ Бул компьютерде: http://localhost:${config.port}`);
  if (ip) console.log(`  ➜ Тармакта:        http://${ip}:${config.port}`);
  if (config.adminPass === 'ordo2026') {
    console.log('  ⚠  Алып баруучунун демейки паролу колдонулууда — server/.env файлында өзгөртүңүз!');
  }
  console.log('');
});

async function shutdown() {
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
