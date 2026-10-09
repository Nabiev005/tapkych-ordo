import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { hashPassword, randomToken, requireSuper } from '../auth.js';
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
/** Gmail (бош сап — өчүрүү) */
const emailSchema = z.union([z.literal(''), z.string().trim().toLowerCase().email().max(120)]);

async function assertEmailFree(email: string, exceptId?: number) {
  const other = await prisma.teacher.findUnique({ where: { email } });
  if (other && other.id !== exceptId) throw new AppError('DUPLICATE_EMAIL');
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new AppError('BAD_REQUEST');
  return id;
}

teachersRouter.get('/', async (_req, res) => {
  const teachers = await prisma.teacher.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, username: true, name: true, email: true, createdAt: true, _count: { select: { questions: true, games: true, assignments: true } } },
  });
  res.json({ teachers });
});

teachersRouter.post('/', async (req, res) => {
  const body = z
    .object({
      username: usernameSchema,
      name: z.string().trim().min(1).max(80),
      // Gmail коюлса, сыр сөз милдеттүү эмес — мугалим Google менен гана кирет
      password: z.union([z.literal(''), passwordSchema]).optional(),
      email: emailSchema.optional(),
    })
    .parse(req.body);
  const email = body.email || null;
  if (!body.password && !email) throw new AppError('BAD_REQUEST');
  if (await prisma.teacher.findUnique({ where: { username: body.username } })) throw new AppError('DUPLICATE_NAME');
  if (email) await assertEmailFree(email);
  const teacher = await prisma.teacher.create({
    data: { username: body.username, name: body.name, email, passwordHash: hashPassword(body.password || randomToken()) },
  });
  res.status(201).json({ teacher: { id: teacher.id, username: teacher.username, name: teacher.name, email } });
});

teachersRouter.patch('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const body = z
    .object({ name: z.string().trim().min(1).max(80).optional(), password: passwordSchema.optional(), email: emailSchema.optional() })
    .parse(req.body);
  if (body.email) await assertEmailFree(body.email, id);
  await prisma.teacher
    .update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.password ? { passwordHash: hashPassword(body.password) } : {}),
        ...(body.email !== undefined ? { email: body.email || null } : {}),
      },
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
