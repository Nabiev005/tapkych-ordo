import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAdmin } from '../auth.js';
import { AppError } from '../types.js';

export const studentsRouter = Router();
studentsRouter.use(requireAdmin);

const nameSchema = z.string().trim().min(1).max(80);
const classSchema = z.string().trim().max(30).default('');

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new AppError('BAD_REQUEST');
  return id;
}

/** Топтун жазылышын бирдейлейбиз: «ит 21», «ИТ - 21» → «ИТ-21» (сызыкча сакталат) */
export function normalizeClass(c: string): string {
  return c
    .trim()
    .replace(/[«»"']+/g, '')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, '')
    .toLocaleUpperCase('ky');
}

studentsRouter.get('/', async (_req, res) => {
  const students = await prisma.student.findMany({
    orderBy: [{ className: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { players: true } } },
  });
  res.json({ students });
});

/**
 * Кошуу: бирөө ({ name, className }) же тизме менен ({ lines: "Аты-жөнү; топ\n…" }).
 * Тизмеде бар студент кайра кошулбайт.
 */
studentsRouter.post('/', async (req, res) => {
  const body = z
    .object({ name: nameSchema.optional(), className: classSchema.optional(), lines: z.string().max(20000).optional() })
    .parse(req.body);

  const items: { name: string; className: string }[] = [];
  if (body.lines) {
    for (const line of body.lines.split(/\r?\n/)) {
      const [name = '', cls = ''] = line.split(/[;\t,]/).map((x) => x.trim());
      if (name) items.push({ name: name.slice(0, 80), className: normalizeClass(cls).slice(0, 30) });
    }
  } else if (body.name) {
    items.push({ name: body.name, className: normalizeClass(body.className ?? '') });
  }
  if (!items.length) throw new AppError('BAD_REQUEST');

  let created = 0;
  const students = [];
  for (const it of items) {
    const existing = await prisma.student.findUnique({ where: { name_className: it } });
    if (existing) {
      students.push(existing);
      continue;
    }
    students.push(await prisma.student.create({ data: it }));
    created++;
  }
  res.status(201).json({ created, students });
});

studentsRouter.patch('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const { name, className } = z.object({ name: nameSchema, className: classSchema }).parse(req.body);
  const data = { name, className: normalizeClass(className) };
  const clash = await prisma.student.findUnique({ where: { name_className: data } });
  if (clash && clash.id !== id) throw new AppError('DUPLICATE_NAME');
  const student = await prisma.student.update({ where: { id }, data }).catch(() => {
    throw new AppError('NOT_FOUND', 404);
  });
  res.json({ student });
});

/** Өчүрүү: студенттин мурунку оюндардагы жыйынтыктары сакталат, бирок рейтингден чыгат */
studentsRouter.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  await prisma.student.delete({ where: { id } }).catch(() => {
    throw new AppError('NOT_FOUND', 404);
  });
  res.json({ ok: true });
});
