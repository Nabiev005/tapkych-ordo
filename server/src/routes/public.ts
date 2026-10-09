import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { config, getLanIp } from '../config.js';
import { checkAdminCredentials, hashPassword, randomToken, requireAdmin, signStaffToken, staff, verifyPassword, type StaffUser } from '../auth.js';
import { FailLimiter } from '../rateLimit.js';
import { bus } from '../events.js';
import { AppError } from '../types.js';
import { verifyGoogleCredential } from '../google.js';

export const publicRouter = Router();

// IP боюнча: 5 мүнөттө 10 ката аракет. Оюн боюнча: 5 мүнөттө 60 ката аракет.
const ipLimiter = new FailLimiter(10, 5 * 60_000);
const gameLimiter = new FailLimiter(60, 5 * 60_000);
const loginLimiter = new FailLimiter(10, 5 * 60_000);

publicRouter.post('/auth/login', async (req, res) => {
  const key = req.ip ?? 'unknown';
  loginLimiter.check(key);
  const { username, password } = z.object({ username: z.string(), password: z.string() }).parse(req.body);
  const u = username.trim();
  const p = password.trim();
  let user: StaffUser | null = null;
  if (checkAdminCredentials(u, p)) {
    user = { role: 'admin', teacherId: null, name: config.adminUser };
  } else {
    // Мугалимдин аккаунту
    const teacher = await prisma.teacher.findUnique({ where: { username: u.toLowerCase() } });
    if (teacher && verifyPassword(p, teacher.passwordHash)) {
      if (!teacher.approved) throw new AppError('TEACHER_PENDING', 403);
      user = { role: 'teacher', teacherId: teacher.id, name: teacher.name };
    }
  }
  if (!user) {
    loginLimiter.fail(key);
    throw new AppError('INVALID_CREDENTIALS', 401);
  }
  loginLimiter.reset(key);
  res.json({ token: signStaffToken(user), user: { role: user.role, name: user.name } });
});

/** Кирүү бети үчүн: «Google менен кирүү» баскычын көрсөтүү керекпи */
publicRouter.get('/auth/config', (_req, res) => {
  res.json({ googleClientId: config.googleClientId || null });
});

/** Ырастоону күтүп жаткан өтүнмөлөрдүн эң көп саны (спамдан коргоо) */
const MAX_PENDING_TEACHERS = 50;

/** Gmail'ден логин жасайбыз: «Aigul.T@gmail.com» → «aigul.t», бош эмес болсо «aigul.t2» … */
async function uniqueUsername(email: string): Promise<string> {
  const base = (email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'teacher').slice(0, 26).padEnd(3, '0');
  for (let i = 1; ; i++) {
    const candidate = i === 1 ? base : `${base}${i}`;
    if (!(await prisma.teacher.findUnique({ where: { username: candidate } }))) return candidate;
  }
}

/**
 * Google менен кирүү:
 *  - Gmail ADMIN_EMAILS ичинде болсо — башкы алып баруучу;
 *  - ырасталган мугалимдин Gmail'и болсо — мугалим;
 *  - жаңы Gmail болсо — мугалим өзү катталат (өтүнмө), башкы алып баруучу «Мугалимдер» бөлүмүнөн ырастайт.
 */
publicRouter.post('/auth/google', async (req, res) => {
  const key = req.ip ?? 'unknown';
  loginLimiter.check(key);
  const { credential } = z.object({ credential: z.string().min(10).max(5000) }).parse(req.body);
  let google: { email: string; name: string };
  try {
    google = await verifyGoogleCredential(credential);
  } catch (e) {
    loginLimiter.fail(key);
    throw e;
  }
  loginLimiter.reset(key);

  if (config.adminEmails.includes(google.email)) {
    const user: StaffUser = { role: 'admin', teacherId: null, name: config.adminUser };
    return res.json({ token: signStaffToken(user), user: { role: user.role, name: user.name } });
  }

  const teacher = await prisma.teacher.findUnique({ where: { email: google.email } });
  if (teacher?.approved) {
    const user: StaffUser = { role: 'teacher', teacherId: teacher.id, name: teacher.name };
    return res.json({ token: signStaffToken(user), user: { role: user.role, name: user.name } });
  }
  if (!teacher) {
    // Жаңы мугалим: өтүнмө түзүлөт (өтө көп болсо — жаңысы кабыл алынбайт)
    if ((await prisma.teacher.count({ where: { approved: false } })) >= MAX_PENDING_TEACHERS) throw new AppError('TOO_MANY_ATTEMPTS', 429);
    await prisma.teacher.create({
      data: {
        username: await uniqueUsername(google.email),
        name: google.name.trim().slice(0, 80) || google.email,
        email: google.email,
        approved: false,
        passwordHash: hashPassword(randomToken()),
      },
    });
  }
  throw new AppError('TEACHER_PENDING', 403);
});

publicRouter.get('/auth/me', requireAdmin, (_req, res) => {
  const user = staff(res);
  res.json({ ok: true, user: { role: user.role, name: user.name } });
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
publicRouter.get('/games/:code', async (req, res, next) => {
  // 6 сандан турган код гана — калгандары (мис. /games/history) алып баруучунун маршруттарына өтөт
  if (!/^\d{6}$/.test(req.params.code)) return next();
  const game = await prisma.game.findUnique({ where: { code: req.params.code } });
  if (!game) throw new AppError('GAME_NOT_FOUND', 404);
  res.json({ game: { code: game.code, status: game.status } });
});
