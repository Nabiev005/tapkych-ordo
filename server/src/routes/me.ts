import { Router } from 'express';
import { z } from 'zod';
import type { LibraryQuestion } from '@prisma/client';
import { prisma } from '../db.js';
import { requireStudent, signStudentToken } from '../auth.js';
import { FailLimiter } from '../rateLimit.js';
import { AppError } from '../types.js';
import { validChoice } from '../game/engine.js';

/**
 * Студенттин кабинети (/me): мугалим берген код менен кирет.
 *  - «Күндүн суроолору» — күн сайын бардык студенттерге бирдей 5 суроо, күнүнө бир жолу
 *  - Машыгуу — тема боюнча каалагандай
 * Суроолор китепканадагы ырасталган суроолордон алынат. Туура жооп текшерилгенге чейин жөнөтүлбөйт.
 */
export const meRouter = Router();

const loginLimiter = new FailLimiter(10, 5 * 60_000);
export const DAILY_COUNT = 5;
const PRACTICE_COUNT = 10;

/** Күндүн белгиси Бишкек убактысы (UTC+6) боюнча: түн ортосунда жаңы суроолор */
export function bishkekDay(now = Date.now()): string {
  return new Date(now + 6 * 3600_000).toISOString().slice(0, 10);
}

const prevDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86400_000).toISOString().slice(0, 10);

/** Күнгө жараша туруктуу аралаштыруу (бир күндө баарына бирдей) */
function seededShuffle<T>(list: T[], seed: string): T[] {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Студентке жөнөтүлүүчү суроо — туура жообу жок */
const publicQuestion = (q: LibraryQuestion) => ({
  id: q.id,
  type: q.type,
  category: q.category,
  difficulty: q.difficulty,
  text: q.text,
  imageUrl: q.imageUrl,
  audioUrl: q.audioUrl,
  options: { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD },
});

async function dailyQuestions(day: string): Promise<LibraryQuestion[]> {
  const all = await prisma.libraryQuestion.findMany({ where: { status: 'APPROVED' }, orderBy: { id: 'asc' } });
  return seededShuffle(all, `daily:${day}`).slice(0, DAILY_COUNT);
}

interface Detail {
  id: number;
  choice: string | null;
  correct: string;
}

/** Жоопторду текшерет. Жооп берилбеген же туура эмес форматтагы жооп — ката. */
function grade(questions: LibraryQuestion[], answers: Map<number, string>) {
  const details: Detail[] = questions.map((q) => {
    const raw = answers.get(q.id)?.toUpperCase() ?? null;
    const choice = raw && validChoice(q.type, raw) ? raw : null;
    return { id: q.id, choice, correct: q.correct };
  });
  return { details, correct: details.filter((d) => d.choice === d.correct).length, total: details.length };
}

/** Текшерилген жыйынтык: ар бир суроо туура жообу менен (кайра карап чыгуу үчүн) */
async function review(details: Detail[]) {
  const qs = await prisma.libraryQuestion.findMany({ where: { id: { in: details.map((d) => d.id) } } });
  return details
    .map((d) => {
      const q = qs.find((x) => x.id === d.id);
      return q ? { ...publicQuestion(q), correct: d.correct, choice: d.choice, isCorrect: d.choice === d.correct } : null;
    })
    .filter((x) => x !== null);
}

/** Катар күндөр: бүгүн (же бүгүн али аткара элек болсо — кечээ) аяктаган серия */
async function streakOf(studentId: number): Promise<{ streak: number; best: number }> {
  const rows = await prisma.practiceAttempt.findMany({ where: { studentId, kind: 'DAILY' }, select: { day: true }, orderBy: { day: 'desc' } });
  const days = [...new Set(rows.map((r) => r.day))];
  const set = new Set(days);
  const today = bishkekDay();
  let cursor = set.has(today) ? today : prevDay(today);
  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    cursor = prevDay(cursor);
  }
  // Эң узун серия
  let best = 0;
  let run = 0;
  let last: string | null = null;
  for (const d of [...days].sort()) {
    run = last && prevDay(d) === last ? run + 1 : 1;
    best = Math.max(best, run);
    last = d;
  }
  return { streak, best };
}

const answersSchema = z.array(z.object({ id: z.number().int(), choice: z.string().max(4) })).max(50);

// ───────────────────────── Кирүү ─────────────────────────

meRouter.post('/login', async (req, res) => {
  const key = req.ip ?? 'unknown';
  loginLimiter.check(key);
  const { code } = z.object({ code: z.string().max(20) }).parse(req.body);
  const accessCode = code.replace(/[\s-]/g, '').toUpperCase();
  const student = accessCode.length >= 4 ? await prisma.student.findUnique({ where: { accessCode } }) : null;
  if (!student) {
    loginLimiter.fail(key);
    throw new AppError('INVALID_CODE', 401);
  }
  loginLimiter.reset(key);
  res.json({ token: signStudentToken(student.id), student: { id: student.id, name: student.name, className: student.className } });
});

meRouter.use(requireStudent);

async function currentStudent(studentId: number) {
  const s = await prisma.student.findUnique({ where: { id: studentId } });
  // Студент өчүрүлсө же коду жаңыланса да, токен 30 күн иштейт — студент өчүрүлгөн болсо кире албайт
  if (!s) throw new AppError('UNAUTHORIZED', 401);
  return s;
}

// ───────────────────────── Кабинеттин башкы бети ─────────────────────────

meRouter.get('/', async (_req, res) => {
  const studentId = res.locals.studentId as number;
  const student = await currentStudent(studentId);
  const today = bishkekDay();
  const attempts = await prisma.practiceAttempt.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' } });
  const daily = attempts.filter((a) => a.kind === 'DAILY');
  const practice = attempts.filter((a) => a.kind === 'PRACTICE');
  // Акыркы 14 күн
  const days: string[] = [];
  for (let d = today, i = 0; i < 14; i++, d = prevDay(d)) days.unshift(d);
  const cats = await prisma.libraryQuestion.groupBy({ by: ['category'], where: { status: 'APPROVED' }, _count: { _all: true } });
  const sum = (list: typeof attempts, k: 'correct' | 'total') => list.reduce((s, a) => s + a[k], 0);

  res.json({
    student: { id: student.id, name: student.name, className: student.className },
    today,
    todayDone: daily.some((a) => a.day === today),
    ...(await streakOf(studentId)),
    calendar: days.map((day) => {
      const a = daily.find((x) => x.day === day);
      return { day, done: !!a, correct: a?.correct ?? 0, total: a?.total ?? 0 };
    }),
    totals: {
      dailyDays: daily.length,
      practiceRuns: practice.length,
      correct: sum(attempts, 'correct'),
      answered: sum(attempts, 'total'),
    },
    recentPractice: practice.slice(0, 5).map((a) => ({ category: a.category, correct: a.correct, total: a.total, createdAt: a.createdAt })),
    categories: cats
      .filter((c) => c.category)
      .map((c) => ({ name: c.category, count: c._count._all }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ky')),
    libraryTotal: cats.reduce((s, c) => s + c._count._all, 0),
  });
});

// ───────────────────────── Күндүн суроолору ─────────────────────────

meRouter.get('/daily', async (_req, res) => {
  const studentId = res.locals.studentId as number;
  await currentStudent(studentId);
  const day = bishkekDay();
  const done = await prisma.practiceAttempt.findFirst({ where: { studentId, kind: 'DAILY', day } });
  if (done) {
    res.json({ day, done: true, result: { correct: done.correct, total: done.total, items: await review(JSON.parse(done.details) as Detail[]) } });
    return;
  }
  const questions = await dailyQuestions(day);
  res.json({ day, done: false, questions: questions.map(publicQuestion) });
});

meRouter.post('/daily', async (req, res) => {
  const studentId = res.locals.studentId as number;
  await currentStudent(studentId);
  const { answers } = z.object({ answers: answersSchema }).parse(req.body);
  const day = bishkekDay();
  if (await prisma.practiceAttempt.findFirst({ where: { studentId, kind: 'DAILY', day } })) throw new AppError('ALREADY_SUBMITTED');
  const questions = await dailyQuestions(day);
  if (!questions.length) throw new AppError('NO_QUESTIONS');
  const g = grade(questions, new Map(answers.map((a) => [a.id, a.choice])));
  await prisma.practiceAttempt.create({ data: { studentId, kind: 'DAILY', day, correct: g.correct, total: g.total, details: JSON.stringify(g.details) } });
  res.json({ correct: g.correct, total: g.total, items: await review(g.details), ...(await streakOf(studentId)) });
});

// ───────────────────────── Машыгуу ─────────────────────────

/**
 * Бүгүнкү «Күндүн суроолору» студент аларды аткарганга чейин машыгууда чыкпайт —
 * антпесе машыгуу аркылуу жоопторун алдын ала билип алса болот. Аткаргандан кийин чектөө жок
 * (китепкана кичине болсо да машыгуу иштейт).
 */
async function hiddenDailyIds(studentId: number): Promise<number[]> {
  const day = bishkekDay();
  if (await prisma.practiceAttempt.findFirst({ where: { studentId, kind: 'DAILY', day } })) return [];
  return (await dailyQuestions(day)).map((q) => q.id);
}

meRouter.get('/practice', async (req, res) => {
  await currentStudent(res.locals.studentId as number);
  const { category } = z.object({ category: z.string().trim().max(40).optional() }).parse(req.query);
  const all = await prisma.libraryQuestion.findMany({
    where: { status: 'APPROVED', id: { notIn: await hiddenDailyIds(res.locals.studentId as number) }, ...(category ? { category } : {}) },
  });
  if (!all.length) throw new AppError('NO_QUESTIONS');
  const picked = seededShuffle(all, `${Date.now()}:${Math.random()}`).slice(0, PRACTICE_COUNT);
  res.json({ questions: picked.map(publicQuestion) });
});

meRouter.post('/practice', async (req, res) => {
  const studentId = res.locals.studentId as number;
  await currentStudent(studentId);
  const body = z.object({ answers: answersSchema.min(1), category: z.string().trim().max(40).default('') }).parse(req.body);
  const category = body.category;
  // Бир суроо бир жолу гана эсептелет
  const answers = [...new Map(body.answers.map((a) => [a.id, a])).values()];
  // Ырасталган суроолор гана текшерилет; бөтөн id'лер жана бүгүнкү күндүн суроолору эсепке алынбайт
  const questions = await prisma.libraryQuestion.findMany({
    where: { id: { in: answers.map((a) => a.id), notIn: await hiddenDailyIds(studentId) }, status: 'APPROVED' },
  });
  if (!questions.length) throw new AppError('NO_QUESTIONS');
  const ordered = answers.map((a) => questions.find((q) => q.id === a.id)).filter((q) => !!q);
  const g = grade(ordered, new Map(answers.map((a) => [a.id, a.choice])));
  await prisma.practiceAttempt.create({
    data: { studentId, kind: 'PRACTICE', day: bishkekDay(), category, correct: g.correct, total: g.total, details: JSON.stringify(g.details) },
  });
  res.json({ correct: g.correct, total: g.total, items: await review(g.details) });
});
