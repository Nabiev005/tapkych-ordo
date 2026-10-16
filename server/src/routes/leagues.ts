import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { assertOwner, ownedWhere, ownerKey, randomAccessCode, requireAdmin, staff } from '../auth.js';
import { bus } from '../events.js';
import { AppError } from '../types.js';
import { computeLeague, leagueSchools } from '../league/standings.js';
import { assignmentBodySchema, createAssignment } from './assignments.js';

/**
 * Мектептер аралык лига. Уюштуруучу мектептердин тизмесин жана турларды түзөт; ар бир тур —
 * бирдей суроолор менен ачык тапшырма (шилтеме /hw/:code). Ачык таблица — /league/:code.
 */
export const leaguesRouter = Router();
leaguesRouter.use(requireAdmin);

/** Ачык бет (/api/league/:code) */
export const leaguePublicRouter = Router();

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new AppError('BAD_REQUEST');
  return id;
}

const schoolsSchema = z
  .array(z.string().trim().min(1).max(80))
  .min(2)
  .max(100)
  .transform((list) => [...new Set(list.map((s) => s.replace(/\s+/g, ' ')))])
  .refine((list) => list.length >= 2);

const leagueSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(''),
  schools: schoolsSchema,
  topN: z.number().int().min(1).max(50).default(5),
});

const roundsInclude = {
  rounds: {
    include: {
      _count: { select: { questions: true } },
      submissions: { select: { name: true, school: true, score: true, answers: true, finishedAt: true } },
    },
  },
} as const;

async function ownedLeague(id: number, res: Parameters<typeof staff>[0]) {
  const league = await prisma.league.findUnique({ where: { id }, include: roundsInclude });
  if (!league) throw new AppError('NOT_FOUND', 404);
  assertOwner(staff(res), league.ownerId);
  return league;
}

async function uniqueLeagueCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = randomAccessCode();
    if (!(await prisma.league.findUnique({ where: { code } }))) return code;
  }
  throw new AppError('SERVER_ERROR', 500);
}

type FullLeague = Awaited<ReturnType<typeof ownedLeague>>;

const view = (l: FullLeague) => ({
  id: l.id,
  code: l.code,
  title: l.title,
  description: l.description,
  topN: l.topN,
  createdAt: l.createdAt,
  ...computeLeague(l, l.rounds),
});

leaguesRouter.get('/', async (_req, res) => {
  const list = await prisma.league.findMany({
    where: ownedWhere(staff(res)),
    orderBy: { createdAt: 'desc' },
    include: { rounds: { select: { _count: { select: { submissions: { where: { finishedAt: { not: null } } } } } } } },
  });
  res.json({
    leagues: list.map((l) => ({
      id: l.id,
      code: l.code,
      title: l.title,
      schools: leagueSchools(l).length,
      rounds: l.rounds.length,
      participants: l.rounds.reduce((n, r) => n + r._count.submissions, 0),
      createdAt: l.createdAt,
    })),
  });
});

leaguesRouter.post('/', async (req, res) => {
  const body = leagueSchema.parse(req.body);
  const league = await prisma.league.create({
    data: { ...body, schools: JSON.stringify(body.schools), code: await uniqueLeagueCode(), ownerId: ownerKey(staff(res)) },
  });
  res.status(201).json({ league: { id: league.id, code: league.code } });
});

leaguesRouter.get('/:id', async (req, res) => {
  res.json({ league: view(await ownedLeague(parseId(req.params.id), res)) });
});

leaguesRouter.patch('/:id', async (req, res) => {
  const l = await ownedLeague(parseId(req.params.id), res);
  const body = leagueSchema.partial().parse(req.body);
  await prisma.league.update({ where: { id: l.id }, data: { ...body, schools: body.schools ? JSON.stringify(body.schools) : undefined } });
  res.json({ ok: true });
});

leaguesRouter.delete('/:id', async (req, res) => {
  const l = await ownedLeague(parseId(req.params.id), res);
  await prisma.league.delete({ where: { id: l.id } });
  bus.emit('rating:changed');
  res.json({ ok: true });
});

/** Жаңы тур: суроолор лиганын уюштуруучусунун банкынан (тапшырмадагыдай) */
leaguesRouter.post('/:id/rounds', async (req, res) => {
  const l = await ownedLeague(parseId(req.params.id), res);
  const round = await createAssignment(l.ownerId, assignmentBodySchema.parse(req.body), l.id);
  res.status(201).json({ round: { id: round.id, code: round.code } });
});

leaguePublicRouter.get('/:code', async (req, res) => {
  const code = req.params.code.toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) throw new AppError('NOT_FOUND', 404);
  const league = await prisma.league.findUnique({ where: { code }, include: roundsInclude });
  if (!league) throw new AppError('NOT_FOUND', 404);
  const { id: _id, ...rest } = view(league);
  res.json({ league: { ...rest, rounds: rest.rounds.map(({ id: _rid, ...r }) => r) } });
});
