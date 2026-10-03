import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { config, getLanIp } from '../config.js';
import { checkAdminCredentials, randomToken, signAdminToken, requireAdmin } from '../auth.js';
import { FailLimiter } from '../rateLimit.js';
import { bus } from '../events.js';
import { AppError } from '../types.js';

export const publicRouter = Router();

// IP боюнча: 5 мүнөттө 10 ката аракет. Оюн боюнча: 5 мүнөттө 60 ката аракет.
const ipLimiter = new FailLimiter(10, 5 * 60_000);
const gameLimiter = new FailLimiter(60, 5 * 60_000);
const loginLimiter = new FailLimiter(10, 5 * 60_000);

publicRouter.post('/auth/login', (req, res) => {
  const key = req.ip ?? 'unknown';
  loginLimiter.check(key);
  const { username, password } = z.object({ username: z.string(), password: z.string() }).parse(req.body);
  if (!checkAdminCredentials(username.trim(), password.trim())) {
    loginLimiter.fail(key);
    throw new AppError('INVALID_CREDENTIALS', 401);
  }
  loginLimiter.reset(key);
  res.json({ token: signAdminToken() });
});

publicRouter.get('/auth/me', requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

/** QR-код үчүн дарек: PUBLIC_URL же ноутбуктун жергиликтүү IP'си */
publicRouter.get('/info', (_req, res) => {
  res.json({ publicUrl: config.publicUrl || null, lanIp: getLanIp() });
});

const joinSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
  pin: z.string().trim().regex(/^\d{4}$/),
});

/** Оюнчу кошулуусу: кошулуу коду + жеке PIN */
publicRouter.post('/join', async (req, res) => {
  const ipKey = req.ip ?? 'unknown';
  ipLimiter.check(ipKey);

  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    ipLimiter.fail(ipKey);
    throw new AppError('INVALID_PIN', 400);
  }
  const { code, pin } = parsed.data;

  const game = await prisma.game.findUnique({ where: { code } });
  if (!game) {
    ipLimiter.fail(ipKey);
    throw new AppError('GAME_NOT_FOUND', 404);
  }
  const gameKey = String(game.id);
  gameLimiter.check(gameKey);

  const player = await prisma.player.findUnique({ where: { gameId_pin: { gameId: game.id, pin } } });
  if (!player) {
    ipLimiter.fail(ipKey);
    gameLimiter.fail(gameKey);
    throw new AppError('INVALID_PIN', 401);
  }
  if (player.status === 'KICKED') throw new AppError('PLAYER_KICKED', 403);

  // Ар бир кирүүдө жаңы токен — мурдагы түзмөк (эгер бар болсо) ажыратылат
  const token = randomToken();
  await prisma.player.update({
    where: { id: player.id },
    data: { token, joinedAt: player.joinedAt ?? new Date() },
  });
  bus.emit('player:session', player.id);
  bus.emit('game:changed', game.id);
  ipLimiter.reset(ipKey);

  res.json({ token, player: { id: player.id, name: player.name }, game: { code: game.code } });
});

/** Жалпы экран үчүн: мындай оюн барбы */
publicRouter.get('/games/:code', async (req, res) => {
  const game = await prisma.game.findUnique({ where: { code: req.params.code } });
  if (!game) throw new AppError('GAME_NOT_FOUND', 404);
  res.json({ game: { code: game.code, status: game.status } });
});
