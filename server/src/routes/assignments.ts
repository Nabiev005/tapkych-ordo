import { Router } from 'express';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { assertOwner, ownedWhere, ownerKey, randomToken, requireAdmin, staff } from '../auth.js';
import { bus } from '../events.js';
import { AppError, DIFFICULTIES } from '../types.js';
import { validChoice } from '../game/engine.js';
import { uniqueCode } from './games.js';
import { correctLabel } from './importExport.js';

/**
 * Үй тапшырмасы: мугалим суроолорду тандап шилтеме берет, студенттер өз убагында иштешет.
 * Ар бир суроонун убактысы сервер боюнча эсептелет. Жыйынтык рейтингге кошулат.
 */
export const assignmentsRouter = Router();
assignmentsRouter.use(requireAdmin);

/** Студенттер үчүн ачык бөлүк (/api/hw) */
export const homeworkRouter = Router();

const GRACE_MS = 1500;

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new AppError('BAD_REQUEST');
  return id;
}

async function ownedAssignment(id: number, res: Parameters<typeof staff>[0]) {
  const a = await prisma.assignment.findUnique({
    where: { id },
    include: { questions: { orderBy: { order: 'asc' } }, submissions: { orderBy: [{ score: 'desc' }, { finishedAt: 'asc' }] } },
  });
  if (!a) throw new AppError('NOT_FOUND', 404);
  assertOwner(staff(res), a.ownerId);
  return a;
}

const isOpen = (a: { active: boolean; closesAt: Date | null }) => a.active && (!a.closesAt || a.closesAt > new Date());

type StoredAnswer = { choice: string | null; correct: boolean; ms: number };

// ─────────────────────────── Мугалим ───────────────────────────

assignmentsRouter.get('/', async (_req, res) => {
  const list = await prisma.assignment.findMany({
    where: ownedWhere(staff(res)),
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { questions: true } }, submissions: { select: { finishedAt: true, score: true } } },
  });
  res.json({
    assignments: list.map((a) => ({
      id: a.id,
      code: a.code,
      title: a.title,
      timerSeconds: a.timerSeconds,
      active: a.active,
      open: isOpen(a),
      closesAt: a.closesAt,
      createdAt: a.createdAt,
      questions: a._count.questions,
      started: a.submissions.length,
      finished: a.submissions.filter((s) => s.finishedAt).length,
    })),
  });
});

/**
 * Жаңы тапшырма: суроолор банктан тандалат (questionIds) же автоматтык түрдө (count + тема/кыйынчылык).
 * Тапшырмадагы суроолор архивге өтпөйт.
 */
assignmentsRouter.post('/', async (req, res) => {
  const body = z
    .object({
      title: z.string().trim().min(1).max(120),
      timerSeconds: z.number().int().min(10).max(300).default(30),
      closesAt: z.coerce.date().nullish(),
      questionIds: z.array(z.number().int()).max(100).optional(),
      auto: z
        .object({
          count: z.number().int().min(1).max(100),
          categories: z.array(z.string()).optional(),
          difficulty: z.enum(DIFFICULTIES).optional(),
          includeArchived: z.boolean().optional(),
        })
        .optional(),
    })
    .parse(req.body);

  const ownerId = ownerKey(staff(res));
  let questions;
  if (body.questionIds?.length) {
    const found = await prisma.question.findMany({ where: { id: { in: body.questionIds }, ownerId } });
    questions = body.questionIds.map((id) => found.find((q) => q.id === id)).filter((q) => !!q);
  } else if (body.auto) {
    const pool = await prisma.question.findMany({
      where: {
        ownerId,
        ...(body.auto.includeArchived ? {} : { archived: false }),
        ...(body.auto.categories?.length ? { category: { in: body.auto.categories } } : {}),
        ...(body.auto.difficulty ? { difficulty: body.auto.difficulty } : {}),
      },
    });
    // Аралаштырып, керектүү санын алабыз
    questions = pool
      .map((q) => [q, Math.random()] as const)
      .sort((a, b) => a[1] - b[1])
      .slice(0, body.auto.count)
      .map(([q]) => q);
  } else throw new AppError('BAD_REQUEST');
  if (!questions.length) throw new AppError('NOT_ENOUGH_QUESTIONS', 400, { need: 1, have: 0 });

  const assignment = await prisma.assignment.create({
    data: {
      ownerId,
      code: await uniqueCode((code) => prisma.assignment.findUnique({ where: { code } })),
      title: body.title,
      timerSeconds: body.timerSeconds,
      closesAt: body.closesAt ?? null,
      questions: {
        create: questions.map((q, order) => ({
          order,
          type: q.type,
          category: q.category,
          text: q.text,
          imageUrl: q.imageUrl,
          audioUrl: q.audioUrl,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correct: q.correct,
        })),
      },
    },
  });
  res.status(201).json({ assignment: { id: assignment.id, code: assignment.code } });
});

assignmentsRouter.get('/:id', async (req, res) => {
  const a = await ownedAssignment(parseId(req.params.id), res);
  res.json({
    assignment: {
      id: a.id,
      code: a.code,
      title: a.title,
      timerSeconds: a.timerSeconds,
      active: a.active,
      open: isOpen(a),
      closesAt: a.closesAt,
      createdAt: a.createdAt,
      questions: a.questions.map((q) => ({ id: q.id, order: q.order, type: q.type, text: q.text, correctLabel: correctLabel(q.type, q.correct) })),
      submissions: a.submissions.map((s) => {
        const answers = JSON.parse(s.answers) as StoredAnswer[];
        return {
          id: s.id,
          name: s.name,
          className: s.className,
          score: s.score,
          correct: s.correct,
          total: a.questions.length,
          answered: answers.length,
          durationMs: answers.reduce((sum, x) => sum + x.ms, 0),
          startedAt: s.startedAt,
          finishedAt: s.finishedAt,
          answers: answers.map((x) => ({ ...x, label: x.choice ? correctLabel(a.questions[answers.indexOf(x)]?.type ?? 'CHOICE', x.choice) : null })),
        };
      }),
    },
  });
});

assignmentsRouter.patch('/:id', async (req, res) => {
  const a = await ownedAssignment(parseId(req.params.id), res);
  const body = z.object({ active: z.boolean().optional(), title: z.string().trim().min(1).max(120).optional(), closesAt: z.coerce.date().nullish() }).parse(req.body);
  await prisma.assignment.update({ where: { id: a.id }, data: body });
  bus.emit('rating:changed');
  res.json({ ok: true });
});

assignmentsRouter.delete('/:id', async (req, res) => {
  const a = await ownedAssignment(parseId(req.params.id), res);
  await prisma.assignment.delete({ where: { id: a.id } });
  bus.emit('rating:changed');
  res.json({ ok: true });
});

/** Студенттин жыйынтыгын өчүрүү (мис. кайра иштөөгө уруксат берүү үчүн) */
assignmentsRouter.delete('/:id/submissions/:sid', async (req, res) => {
  const a = await ownedAssignment(parseId(req.params.id), res);
  await prisma.submission.deleteMany({ where: { id: parseId(req.params.sid), assignmentId: a.id } });
  bus.emit('rating:changed');
  res.json({ ok: true });
});

assignmentsRouter.get('/:id/export.xlsx', async (req, res) => {
  const a = await ownedAssignment(parseId(req.params.id), res);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Жыйынтык');
  ws.addRow(['Орун', 'Аты-жөнү', 'Тобу', 'Упай', 'Туура', 'Суроолор', 'Убакыт (сек)', 'Бүттү', ...a.questions.map((q) => `№${q.order + 1} (${correctLabel(q.type, q.correct)})`)]);
  a.submissions.forEach((s, i) => {
    const answers = JSON.parse(s.answers) as StoredAnswer[];
    ws.addRow([
      i + 1,
      s.name,
      s.className,
      s.score,
      s.correct,
      a.questions.length,
      Math.round(answers.reduce((sum, x) => sum + x.ms, 0) / 1000),
      s.finishedAt ? s.finishedAt.toISOString().replace('T', ' ').slice(0, 16) : '—',
      ...a.questions.map((q, k) => {
        const x = answers[k];
        if (!x) return '—';
        return x.choice ? `${correctLabel(q.type, x.choice)} ${x.correct ? '✓' : '✗'}` : '⌛';
      }),
    ]);
  });
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8102E' } };
  ws.columns.forEach((c, i) => (c.width = i === 1 ? 30 : 12));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`тапшырма-${a.code}.xlsx`)}`);
  await wb.xlsx.write(res);
  res.end();
});

// ─────────────────────────── Студент (ачык) ───────────────────────────

homeworkRouter.get('/:code', async (req, res) => {
  if (!/^\d{6}$/.test(req.params.code)) throw new AppError('NOT_FOUND', 404);
  const a = await prisma.assignment.findUnique({ where: { code: req.params.code }, include: { _count: { select: { questions: true } } } });
  if (!a) throw new AppError('NOT_FOUND', 404);
  const students = await prisma.student.findMany({ orderBy: [{ className: 'asc' }, { name: 'asc' }], select: { id: true, name: true, className: true } });
  res.json({
    assignment: { title: a.title, questions: a._count.questions, timerSeconds: a.timerSeconds, open: isOpen(a), closesAt: a.closesAt },
    students,
  });
});

/** Баштоо же улантуу: студент тизмеден өзүн тандайт */
homeworkRouter.post('/:code/start', async (req, res) => {
  const { studentId } = z.object({ studentId: z.number().int() }).parse(req.body);
  const a = await prisma.assignment.findUnique({ where: { code: req.params.code } });
  if (!a) throw new AppError('NOT_FOUND', 404);
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new AppError('NOT_FOUND', 404);
  const existing = await prisma.submission.findUnique({ where: { assignmentId_studentId: { assignmentId: a.id, studentId } } });
  if (existing) {
    // Бүткөн болсо — жыйынтыкты гана көрө алат
    res.json({ token: existing.token, finished: !!existing.finishedAt });
    return;
  }
  if (!isOpen(a)) throw new AppError('ASSIGNMENT_CLOSED');
  const sub = await prisma.submission.create({
    data: { assignmentId: a.id, studentId, name: student.name, className: student.className, token: randomToken() },
  });
  res.status(201).json({ token: sub.token, finished: false });
});

async function loadSession(token: string) {
  const sub = await prisma.submission.findUnique({
    where: { token },
    include: { assignment: { include: { questions: { orderBy: { order: 'asc' } } } } },
  });
  if (!sub) throw new AppError('NOT_FOUND', 404);
  return sub;
}

type Session = Awaited<ReturnType<typeof loadSession>>;

/** Убакыты өтүп кеткен суроолорду «жооп жок» деп белгилеп, учурдагы суроого жетебиз */
async function advanceTimeouts(sub: Session): Promise<Session> {
  const qs = sub.assignment.questions;
  const answers = JSON.parse(sub.answers) as StoredAnswer[];
  let index = sub.index;
  let started = sub.currentStartedAt;
  const limit = sub.assignment.timerSeconds * 1000;
  let changed = false;
  while (!sub.finishedAt && index < qs.length && started && Date.now() > started.getTime() + limit + GRACE_MS) {
    answers.push({ choice: null, correct: false, ms: limit });
    index++;
    // Кийинки суроонун убактысы мурункусунун мөөнөтү бүткөндөн баштап эсептелет
    started = index < qs.length ? new Date(started.getTime() + limit + GRACE_MS) : null;
    changed = true;
  }
  if (!changed) return sub;
  return finishIfDone(sub, answers, index, started);
}

async function finishIfDone(sub: Session, answers: StoredAnswer[], index: number, started: Date | null): Promise<Session> {
  const done = index >= sub.assignment.questions.length;
  const correct = answers.filter((x) => x.correct).length;
  await prisma.submission.update({
    where: { id: sub.id },
    data: {
      answers: JSON.stringify(answers),
      index,
      currentStartedAt: done ? null : started,
      correct,
      score: correct,
      ...(done ? { finishedAt: new Date() } : {}),
    },
  });
  if (done) bus.emit('rating:changed');
  return loadSession(sub.token);
}

function sessionView(sub: Session) {
  const qs = sub.assignment.questions;
  const answers = JSON.parse(sub.answers) as StoredAnswer[];
  const base = { title: sub.assignment.title, name: sub.name, index: sub.index, total: qs.length, timerSeconds: sub.assignment.timerSeconds, serverNow: Date.now() };
  if (sub.finishedAt) {
    return {
      ...base,
      finished: true,
      result: {
        score: sub.score,
        correct: sub.correct,
        // Туура жооптор тапшырма бүткөндөн кийин гана көрсөтүлөт
        review: qs.map((q, i) => ({
          text: q.text,
          type: q.type,
          options: { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD },
          correct: q.correct,
          choice: answers[i]?.choice ?? null,
          isCorrect: answers[i]?.correct ?? false,
        })),
      },
    };
  }
  const q = qs[sub.index];
  return {
    ...base,
    finished: false,
    question: q
      ? {
          number: sub.index + 1,
          type: q.type,
          category: q.category,
          text: q.text,
          imageUrl: q.imageUrl,
          audioUrl: q.audioUrl,
          options: { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD },
          deadline: sub.currentStartedAt ? sub.currentStartedAt.getTime() + sub.assignment.timerSeconds * 1000 : null,
        }
      : null,
  };
}

homeworkRouter.get('/session/:token', async (req, res) => {
  let sub = await advanceTimeouts(await loadSession(req.params.token));
  // Суроо биринчи жолу көрсөтүлгөн учурдан убакыт башталат
  if (!sub.finishedAt && !sub.currentStartedAt) {
    await prisma.submission.update({ where: { id: sub.id }, data: { currentStartedAt: new Date() } });
    sub = await loadSession(sub.token);
  }
  res.json(sessionView(sub));
});

homeworkRouter.post('/session/:token/answer', async (req, res) => {
  const { choice: raw, number } = z.object({ choice: z.string(), number: z.number().int() }).parse(req.body);
  const sub = await advanceTimeouts(await loadSession(req.params.token));
  if (sub.finishedAt) throw new AppError('ALREADY_SUBMITTED');
  // Эски суроого жооп келсе (мис. убакыт бүтүп калган) — кабыл алынбайт
  if (number !== sub.index + 1 || !sub.currentStartedAt) throw new AppError('TIME_UP');
  const q = sub.assignment.questions[sub.index];
  const choice = raw.toUpperCase();
  if (!validChoice(q.type, choice)) throw new AppError('BAD_REQUEST');
  const answers = JSON.parse(sub.answers) as StoredAnswer[];
  const ms = Math.min(sub.assignment.timerSeconds * 1000, Date.now() - sub.currentStartedAt.getTime());
  answers.push({ choice, correct: choice === q.correct, ms });
  const next = await finishIfDone(sub, answers, sub.index + 1, sub.index + 1 < sub.assignment.questions.length ? new Date() : null);
  res.json(sessionView(next));
});
