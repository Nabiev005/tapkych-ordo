import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAdmin } from '../auth.js';
import { AppError, OPTIONS, ROUNDS, type Round } from '../types.js';

export const questionsRouter = Router();
questionsRouter.use(requireAdmin);

/** Ар бир турга демейки талап кылынган суроолордун саны */
export const DEFAULT_REQUIRED: Record<Round, number> = { ROUND1: 10, ROUND2: 10, FINAL: 5 };

const questionSchema = z.object({
  round: z.enum(ROUNDS),
  text: z.string().trim().min(1).max(1000),
  imageUrl: z.string().trim().max(500).nullish(),
  optionA: z.string().trim().min(1).max(300),
  optionB: z.string().trim().min(1).max(300),
  optionC: z.string().trim().min(1).max(300),
  optionD: z.string().trim().min(1).max(300),
  correct: z.enum(OPTIONS),
});

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new AppError('BAD_REQUEST');
  return id;
}

async function nextOrder(round: Round): Promise<number> {
  const last = await prisma.question.findFirst({ where: { round, archived: false }, orderBy: { order: 'desc' } });
  return (last?.order ?? -1) + 1;
}

questionsRouter.get('/', async (_req, res) => {
  const questions = await prisma.question.findMany({ orderBy: [{ round: 'asc' }, { order: 'asc' }] });
  res.json({ questions });
});

/** Ар бир турда суроолор жетиштүүбү — "1-турда 10 суроо бар ✓" (архивдегилер эсептелбейт) */
questionsRouter.get('/summary', async (_req, res) => {
  const groups = await prisma.question.groupBy({ by: ['round'], where: { archived: false }, _count: { _all: true } });
  const summary = ROUNDS.map((round) => {
    const count = groups.find((g) => g.round === round)?._count._all ?? 0;
    return { round, count, required: DEFAULT_REQUIRED[round], ok: count >= DEFAULT_REQUIRED[round] };
  });
  res.json({ summary });
});

questionsRouter.post('/', async (req, res) => {
  const data = questionSchema.parse(req.body);
  const question = await prisma.question.create({
    data: { ...data, imageUrl: data.imageUrl || null, order: await nextOrder(data.round) },
  });
  res.status(201).json({ question });
});

/** Тартипти өзгөртүү (сүйрөп жылдыруудан кийин) — бул маршрут /:id'ден мурун турушу керек */
questionsRouter.put('/reorder', async (req, res) => {
  const { round, ids } = z.object({ round: z.enum(ROUNDS), ids: z.array(z.number().int()) }).parse(req.body);
  await prisma.$transaction(
    ids.map((id, index) => prisma.question.update({ where: { id }, data: { order: index, round } })),
  );
  res.json({ ok: true });
});

/** Архивден кайра банкка кайтаруу: бир суроо же бир турдун баары (ids жок болсо) */
questionsRouter.post('/restore', async (req, res) => {
  const { ids, round } = z.object({ ids: z.array(z.number().int()).optional(), round: z.enum(ROUNDS).optional() }).parse(req.body);
  const list = await prisma.question.findMany({
    where: { archived: true, ...(ids ? { id: { in: ids } } : {}), ...(round ? { round } : {}) },
    orderBy: [{ round: 'asc' }, { lastUsedAt: 'asc' }],
  });
  for (const q of list) {
    await prisma.question.update({ where: { id: q.id }, data: { archived: false, order: await nextOrder(q.round as Round) } });
  }
  res.json({ restored: list.length });
});

/** Колдонулбаса да кол менен архивге жылдыруу */
questionsRouter.post('/:id/archive', async (req, res) => {
  const id = parseId(req.params.id);
  await prisma.question.update({ where: { id }, data: { archived: true } }).catch(() => {
    throw new AppError('NOT_FOUND', 404);
  });
  res.json({ ok: true });
});

questionsRouter.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const data = questionSchema.parse(req.body);
  const existing = await prisma.question.findUnique({ where: { id } });
  if (!existing) throw new AppError('NOT_FOUND', 404);
  const order = existing.round === data.round || existing.archived ? existing.order : await nextOrder(data.round);
  const question = await prisma.question.update({
    where: { id },
    data: { ...data, imageUrl: data.imageUrl || null, order },
  });
  res.json({ question });
});

questionsRouter.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  await prisma.question.delete({ where: { id } }).catch(() => {
    throw new AppError('NOT_FOUND', 404);
  });
  res.json({ ok: true });
});
