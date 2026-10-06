import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { hashPassword, requireSuper } from '../auth.js';
import { AppError } from '../types.js';

/** Мугалимдердин аккаунттары — башкы алып баруучу гана башкарат */
export const teachersRouter = Router();
teachersRouter.use(requireSuper);

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,30}$/);
const passwordSchema = z.string().trim().min(6).max(100);

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new AppError('BAD_REQUEST');
  return id;
}

teachersRouter.get('/', async (_req, res) => {
  const teachers = await prisma.teacher.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, username: true, name: true, createdAt: true, _count: { select: { questions: true, games: true, assignments: true } } },
  });
  res.json({ teachers });
});

teachersRouter.post('/', async (req, res) => {
  const { username, name, password } = z.object({ username: usernameSchema, name: z.string().trim().min(1).max(80), password: passwordSchema }).parse(req.body);
  if (await prisma.teacher.findUnique({ where: { username } })) throw new AppError('DUPLICATE_NAME');
  const teacher = await prisma.teacher.create({ data: { username, name, passwordHash: hashPassword(password) } });
  res.status(201).json({ teacher: { id: teacher.id, username, name } });
});

teachersRouter.patch('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const body = z.object({ name: z.string().trim().min(1).max(80).optional(), password: passwordSchema.optional() }).parse(req.body);
  await prisma.teacher
    .update({
      where: { id },
      data: { ...(body.name ? { name: body.name } : {}), ...(body.password ? { passwordHash: hashPassword(body.password) } : {}) },
    })
    .catch(() => {
      throw new AppError('NOT_FOUND', 404);
    });
  res.json({ ok: true });
});

/** Өчүрүү: мугалимдин суроолору да өчөт, оюндары жана тапшырмалары тарыхта калат */
teachersRouter.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  await prisma.teacher.delete({ where: { id } }).catch(() => {
    throw new AppError('NOT_FOUND', 404);
  });
  res.json({ ok: true });
});
