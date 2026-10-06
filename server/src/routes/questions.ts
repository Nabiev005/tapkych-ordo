import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { assertOwner, ownerKey, requireAdmin, staff } from '../auth.js';
import { AppError, DIFFICULTIES, OPTIONS, QUESTION_TYPES, ROUNDS, type Round } from '../types.js';

export const questionsRouter = Router();
questionsRouter.use(requireAdmin);

/** Ар бир турга демейки талап кылынган суроолордун саны */
export const DEFAULT_REQUIRED: Record<Round, number> = { ROUND1: 10, ROUND2: 10, FINAL: 5 };

/** «Туура / Туура эмес» суроонун варианттары (банкта ушундай сакталат) */
export const TF_OPTIONS = { optionA: 'Туура', optionB: 'Туура эмес', optionC: '', optionD: '' };

const opt = z.string().trim().max(300);
export const questionSchema = z
  .object({
    round: z.enum(ROUNDS),
    type: z.enum(QUESTION_TYPES).default('CHOICE'),
    category: z.string().trim().max(40).default(''),
    difficulty: z.enum(DIFFICULTIES).default('MEDIUM'),
    text: z.string().trim().min(1).max(1000),
    imageUrl: z.string().trim().max(500).nullish(),
    audioUrl: z.string().trim().max(500).nullish(),
    optionA: opt.default(''),
    optionB: opt.default(''),
    optionC: opt.default(''),
    optionD: opt.default(''),
    correct: z.string().trim().toUpperCase(),
  })
  .transform((q) => (q.type === 'TF' ? { ...q, ...TF_OPTIONS } : q))
  .superRefine((q, ctx) => {
    const fail = () => ctx.addIssue({ code: 'custom', message: 'INVALID_QUESTION' });
    if (q.type === 'TF') {
      if (q.correct !== 'A' && q.correct !== 'B') fail();
      return;
    }
    if (![q.optionA, q.optionB, q.optionC, q.optionD].every(Boolean)) fail();
    if (q.type === 'CHOICE' && !(OPTIONS as readonly string[]).includes(q.correct)) fail();
    // ORDER: туура тартип — A, B, C, D тамгаларынын ар бири бир жолудан
    if (q.type === 'ORDER' && (q.correct.length !== 4 || [...q.correct].sort().join('') !== 'ABCD')) fail();
  });

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new AppError('BAD_REQUEST');
  return id;
}

async function nextOrder(ownerId: number | null, round: Round): Promise<number> {
  const last = await prisma.question.findFirst({ where: { ownerId, round, archived: false }, orderBy: { order: 'desc' } });
  return (last?.order ?? -1) + 1;
}

async function ownedQuestion(res: Parameters<typeof staff>[0], id: number) {
  const q = await prisma.question.findUnique({ where: { id } });
  if (!q) throw new AppError('NOT_FOUND', 404);
  assertOwner(staff(res), q.ownerId);
  return q;
}

questionsRouter.get('/', async (_req, res) => {
  const questions = await prisma.question.findMany({
    where: { ownerId: ownerKey(staff(res)) },
    orderBy: [{ round: 'asc' }, { order: 'asc' }],
  });
  res.json({ questions });
});

/** Ар бир турда суроолор жетиштүүбү — "1-турда 10 суроо бар ✓" (архивдегилер эсептелбейт) */
questionsRouter.get('/summary', async (_req, res) => {
  const where = { ownerId: ownerKey(staff(res)), archived: false };
  const groups = await prisma.question.groupBy({ by: ['round'], where, _count: { _all: true } });
  const summary = ROUNDS.map((round) => {
    const count = groups.find((g) => g.round === round)?._count._all ?? 0;
    return { round, count, required: DEFAULT_REQUIRED[round], ok: count >= DEFAULT_REQUIRED[round] };
  });
  // Темалар жана кыйынчылык боюнча (оюн түзүүдө тандоо үчүн)
  const byCategory = await prisma.question.groupBy({ by: ['category'], where, _count: { _all: true } });
  const byDifficulty = await prisma.question.groupBy({ by: ['difficulty'], where, _count: { _all: true } });
  res.json({
    summary,
    total: summary.reduce((s, x) => s + x.count, 0),
    categories: byCategory.filter((c) => c.category).map((c) => ({ name: c.category, count: c._count._all })),
    difficulties: Object.fromEntries(byDifficulty.map((d) => [d.difficulty, d._count._all])),
  });
});

questionsRouter.post('/', async (req, res) => {
  const data = questionSchema.parse(req.body);
  const ownerId = ownerKey(staff(res));
  const question = await prisma.question.create({
    data: { ...data, ownerId, imageUrl: data.imageUrl || null, audioUrl: data.audioUrl || null, order: await nextOrder(ownerId, data.round) },
  });
  res.status(201).json({ question });
});

/** Тартипти өзгөртүү (сүйрөп жылдыруудан кийин) — бул маршрут /:id'ден мурун турушу керек */
questionsRouter.put('/reorder', async (req, res) => {
  const { round, ids } = z.object({ round: z.enum(ROUNDS), ids: z.array(z.number().int()) }).parse(req.body);
  const ownerId = ownerKey(staff(res));
  await prisma.$transaction(
    ids.map((id, index) => prisma.question.updateMany({ where: { id, ownerId }, data: { order: index, round } })),
  );
  res.json({ ok: true });
});

/** Архивден кайра банкка кайтаруу: бир суроо же бир турдун баары (ids жок болсо) */
questionsRouter.post('/restore', async (req, res) => {
  const { ids, round } = z.object({ ids: z.array(z.number().int()).optional(), round: z.enum(ROUNDS).optional() }).parse(req.body);
  const ownerId = ownerKey(staff(res));
  const list = await prisma.question.findMany({
    where: { ownerId, archived: true, ...(ids ? { id: { in: ids } } : {}), ...(round ? { round } : {}) },
    orderBy: [{ round: 'asc' }, { lastUsedAt: 'asc' }],
  });
  for (const q of list) {
    await prisma.question.update({ where: { id: q.id }, data: { archived: false, order: await nextOrder(ownerId, q.round as Round) } });
  }
  res.json({ restored: list.length });
});

/** Колдонулбаса да кол менен архивге жылдыруу */
questionsRouter.post('/:id/archive', async (req, res) => {
  const q = await ownedQuestion(res, parseId(req.params.id));
  await prisma.question.update({ where: { id: q.id }, data: { archived: true } });
  res.json({ ok: true });
});

questionsRouter.put('/:id', async (req, res) => {
  const existing = await ownedQuestion(res, parseId(req.params.id));
  const data = questionSchema.parse(req.body);
  const order = existing.round === data.round || existing.archived ? existing.order : await nextOrder(existing.ownerId, data.round);
  const question = await prisma.question.update({
    where: { id: existing.id },
    data: { ...data, imageUrl: data.imageUrl || null, audioUrl: data.audioUrl || null, order },
  });
  res.json({ question });
});

questionsRouter.delete('/:id', async (req, res) => {
  const q = await ownedQuestion(res, parseId(req.params.id));
  await prisma.question.delete({ where: { id: q.id } });
  res.json({ ok: true });
});
