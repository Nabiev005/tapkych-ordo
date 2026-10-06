import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireSuper } from '../auth.js';
import { bus } from '../events.js';
import { AppError } from '../types.js';

/** Рейтингдин сезондору: тизме — ачык, башкаруу — башкы алып баруучу гана */
export const seasonsRouter = Router();

const seasonSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((s) => s.endsAt > s.startsAt, { message: 'DATES' });

seasonsRouter.get('/', async (_req, res) => {
  const seasons = await prisma.season.findMany({ orderBy: { startsAt: 'desc' } });
  res.json({ seasons });
});

seasonsRouter.post('/', requireSuper, async (req, res) => {
  const data = seasonSchema.parse(req.body);
  // Аяктоо күнү толугу менен кирсин (23:59:59)
  data.endsAt.setHours(23, 59, 59, 999);
  const season = await prisma.season.create({ data });
  bus.emit('rating:changed');
  res.status(201).json({ season });
});

seasonsRouter.patch('/:id', requireSuper, async (req, res) => {
  const id = Number(req.params.id);
  const data = seasonSchema.parse(req.body);
  data.endsAt.setHours(23, 59, 59, 999);
  const season = await prisma.season.update({ where: { id }, data }).catch(() => {
    throw new AppError('NOT_FOUND', 404);
  });
  bus.emit('rating:changed');
  res.json({ season });
});

seasonsRouter.delete('/:id', requireSuper, async (req, res) => {
  await prisma.season.delete({ where: { id: Number(req.params.id) } }).catch(() => {
    throw new AppError('NOT_FOUND', 404);
  });
  bus.emit('rating:changed');
  res.json({ ok: true });
});
