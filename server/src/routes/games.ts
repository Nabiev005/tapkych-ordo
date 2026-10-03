import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAdmin } from '../auth.js';
import { bus } from '../events.js';
import { AppError } from '../types.js';

export const gamesRouter = Router();
gamesRouter.use(requireAdmin);

const nameSchema = z.string().trim().min(1).max(60);

const settingsSchema = z.object({
  pointsPerCorrect: z.number().int().min(1).max(100),
  timerSeconds: z.number().int().min(5).max(120),
  round1Count: z.number().int().min(1).max(50),
  round2Count: z.number().int().min(1).max(50),
  finalQuestionCount: z.number().int().min(1).max(50),
  advanceToRound2: z.number().int().min(2).max(100),
  advanceToFinal: z.number().int().min(1).max(100),
  expectedPlayers: z.number().int().min(2).max(100),
  soundEnabled: z.boolean(),
});

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new AppError('BAD_REQUEST');
  return id;
}

const randomDigits = (n: number) =>
  String(crypto.randomInt(10 ** (n - 1), 10 ** n));

async function uniqueGameCode(): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const code = randomDigits(6);
    if (!(await prisma.game.findUnique({ where: { code } }))) return code;
  }
  throw new AppError('SERVER_ERROR', 500);
}

function uniquePin(taken: Set<string>): string {
  for (;;) {
    const pin = randomDigits(4);
    if (!taken.has(pin)) {
      taken.add(pin);
      return pin;
    }
  }
}

function assertUniqueNames(names: string[]) {
  const seen = new Set<string>();
  for (const n of names) {
    const key = n.toLocaleLowerCase('ky');
    if (seen.has(key)) throw new AppError('DUPLICATE_NAME', 400, { name: n });
    seen.add(key);
  }
}

async function loadGame(id: number) {
  const game = await prisma.game.findUnique({
    where: { id },
    include: { players: { orderBy: { seat: 'asc' } } },
  });
  if (!game) throw new AppError('GAME_NOT_FOUND', 404);
  return game;
}

async function requireLobby(id: number) {
  const game = await loadGame(id);
  if (game.status !== 'LOBBY') throw new AppError('GAME_ALREADY_STARTED');
  return game;
}

gamesRouter.get('/', async (_req, res) => {
  const games = await prisma.game.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { players: true } } },
  });
  res.json({ games });
});

/** Жаңы оюн: оюнчулардын аттары + жөндөөлөр → код жана жеке PIN'дер түзүлөт */
gamesRouter.post('/', async (req, res) => {
  const body = z
    .object({ players: z.array(nameSchema).max(100), settings: settingsSchema.partial().optional() })
    .parse(req.body);
  assertUniqueNames(body.players);
  const pins = new Set<string>();
  const game = await prisma.game.create({
    data: {
      code: await uniqueGameCode(),
      ...body.settings,
      players: { create: body.players.map((name, seat) => ({ name, seat, pin: uniquePin(pins) })) },
    },
  });
  res.status(201).json({ game: await loadGame(game.id) });
});

gamesRouter.get('/:id', async (req, res) => {
  res.json({ game: await loadGame(parseId(req.params.id)) });
});

gamesRouter.patch('/:id/settings', async (req, res) => {
  const id = parseId(req.params.id);
  const data = settingsSchema.partial().parse(req.body);
  const game = await loadGame(id);
  // Оюн башталгандан кийин үндү гана өзгөртүүгө болот
  const onlySound = Object.keys(data).every((k) => k === 'soundEnabled');
  if (game.status !== 'LOBBY' && !onlySound) throw new AppError('GAME_ALREADY_STARTED');
  await prisma.game.update({ where: { id }, data });
  bus.emit('game:changed', id);
  res.json({ game: await loadGame(id) });
});

gamesRouter.post('/:id/players', async (req, res) => {
  const id = parseId(req.params.id);
  const { name } = z.object({ name: nameSchema }).parse(req.body);
  const game = await requireLobby(id);
  assertUniqueNames([...game.players.map((p) => p.name), name]);
  const pins = new Set(game.players.map((p) => p.pin));
  const seat = Math.max(-1, ...game.players.map((p) => p.seat)) + 1;
  await prisma.player.create({ data: { gameId: id, name, seat, pin: uniquePin(pins) } });
  bus.emit('game:changed', id);
  res.status(201).json({ game: await loadGame(id) });
});

gamesRouter.patch('/:id/players/:pid', async (req, res) => {
  const id = parseId(req.params.id);
  const pid = parseId(req.params.pid);
  const { name } = z.object({ name: nameSchema }).parse(req.body);
  const game = await loadGame(id);
  assertUniqueNames([...game.players.filter((p) => p.id !== pid).map((p) => p.name), name]);
  await prisma.player.updateMany({ where: { id: pid, gameId: id }, data: { name } });
  bus.emit('game:changed', id);
  res.json({ game: await loadGame(id) });
});

/** Жаңы PIN берүү (мисалы, PIN бөтөн адамга белгилүү болуп калса). Эски түзмөк ажыратылат. */
gamesRouter.post('/:id/players/:pid/new-pin', async (req, res) => {
  const id = parseId(req.params.id);
  const pid = parseId(req.params.pid);
  const game = await loadGame(id);
  if (!game.players.some((p) => p.id === pid)) throw new AppError('NOT_FOUND', 404);
  const pins = new Set(game.players.map((p) => p.pin));
  await prisma.player.update({ where: { id: pid }, data: { pin: uniquePin(pins), token: null } });
  bus.emit('player:session', pid);
  bus.emit('game:changed', id);
  res.json({ game: await loadGame(id) });
});

gamesRouter.delete('/:id/players/:pid', async (req, res) => {
  const id = parseId(req.params.id);
  const pid = parseId(req.params.pid);
  await requireLobby(id);
  await prisma.player.deleteMany({ where: { id: pid, gameId: id } });
  bus.emit('player:session', pid);
  bus.emit('game:changed', id);
  res.json({ game: await loadGame(id) });
});

gamesRouter.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  await prisma.game.delete({ where: { id } }).catch(() => {
    throw new AppError('GAME_NOT_FOUND', 404);
  });
  bus.emit('game:changed', id);
  res.json({ ok: true });
});
