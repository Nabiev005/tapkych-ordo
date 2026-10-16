import { prisma } from '../db.js';
import { MIN_ANSWERS } from '../library/stats.js';
import { bishkekDay, lastDays, streakFromDays, WEEK } from './activity.js';

/**
 * Мугалимдин аналитикасы: ким машыгып жатат, ким токтоп калды, топ кайсы темада алсыз.
 * Булактары: студенттин кабинети (PracticeAttempt) жана оюндардагы жооптор (Player.studentId).
 */

/** Ушунча күн машыкпаса — «токтоп калды» */
export const STOPPED_AFTER = 3;
/** Студенттин алсыз темасы: эң аз ушунча жооп жана тактыгы ушундан төмөн */
const WEAK_MIN = 3;
const WEAK_BELOW = 0.6;

export type StudentStatus = 'ACTIVE' | 'STOPPED' | 'NEVER' | 'NO_CODE';

interface Tally {
  answered: number;
  correct: number;
}

const pct = (t: Tally | undefined, min = 1): number | null => (t && t.answered >= min ? Math.round((t.correct / t.answered) * 100) : null);

function add(map: Map<string, Tally>, key: string, ok: boolean) {
  const t = map.get(key) ?? { answered: 0, correct: 0 };
  t.answered++;
  if (ok) t.correct++;
  map.set(key, t);
}

/** Эки күндүн айырмасы (YYYY-MM-DD) */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400_000);

export async function teacherAnalytics(className = '') {
  const today = bishkekDay();
  const days = lastDays(WEEK, today);
  const from = days[0];

  const allStudents = await prisma.student.findMany({
    select: { id: true, name: true, className: true, accessCode: true, telegramChatId: true },
    orderBy: [{ className: 'asc' }, { name: 'asc' }],
  });
  const classes = [...new Set(allStudents.map((s) => s.className).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ky', { numeric: true }));
  const students = className ? allStudents.filter((s) => s.className === className) : allStudents;
  const ids = students.map((s) => s.id);

  const [attempts, answers] = await Promise.all([
    prisma.practiceAttempt.findMany({ where: { studentId: { in: ids } }, select: { studentId: true, kind: true, day: true, correct: true, total: true, details: true } }),
    prisma.answer.findMany({
      where: { player: { studentId: { in: ids } } },
      select: { isCorrect: true, player: { select: { studentId: true } }, gameQuestion: { select: { category: true } } },
    }),
  ]);

  // Машыгуудагы суроолордун темасы — китепканадан (өчүрүлгөн суроолор эсепке кирбейт)
  const parsed = attempts.map((a) => {
    let details: { id: number; choice: string | null; correct: string }[] = [];
    try {
      details = JSON.parse(a.details);
    } catch {
      /* бузук жазуу — темасыз калат */
    }
    return { ...a, details };
  });
  const libIds = [...new Set(parsed.flatMap((a) => a.details.map((d) => d.id)))];
  const libCats = new Map(
    (await prisma.libraryQuestion.findMany({ where: { id: { in: libIds } }, select: { id: true, category: true } })).map((q) => [q.id, q.category]),
  );

  const groupTopics = new Map<string, Tally>();
  const per = new Map<number, { days: Set<string>; topics: Map<string, Tally>; all: Tally; week: Tally }>();
  const slot = (id: number) => {
    let p = per.get(id);
    if (!p) per.set(id, (p = { days: new Set(), topics: new Map(), all: { answered: 0, correct: 0 }, week: { answered: 0, correct: 0 } }));
    return p;
  };

  for (const a of parsed) {
    const p = slot(a.studentId);
    p.days.add(a.day);
    p.all.answered += a.total;
    p.all.correct += a.correct;
    if (a.day >= from) {
      p.week.answered += a.total;
      p.week.correct += a.correct;
    }
    for (const d of a.details) {
      const cat = libCats.get(d.id);
      if (!cat) continue;
      add(p.topics, cat, d.choice === d.correct);
      add(groupTopics, cat, d.choice === d.correct);
    }
  }
  for (const a of answers) {
    const id = a.player.studentId;
    if (!id) continue;
    const p = slot(id);
    p.all.answered++;
    if (a.isCorrect) p.all.correct++;
    const cat = a.gameQuestion.category;
    if (!cat) continue;
    add(p.topics, cat, a.isCorrect);
    add(groupTopics, cat, a.isCorrect);
  }

  const rows = students.map((s) => {
    const p = per.get(s.id);
    const practiceDays = p ? [...p.days].sort() : [];
    const lastDay = practiceDays.length ? practiceDays[practiceDays.length - 1] : null;
    const daysAgo = lastDay ? daysBetween(lastDay, today) : null;
    const status: StudentStatus =
      daysAgo === null ? (s.accessCode ? 'NEVER' : 'NO_CODE') : daysAgo >= STOPPED_AFTER ? 'STOPPED' : 'ACTIVE';
    const weak = p
      ? [...p.topics.entries()]
          .filter(([, t]) => t.answered >= WEAK_MIN && t.correct / t.answered < WEAK_BELOW)
          .sort((a, b) => a[1].correct / a[1].answered - b[1].correct / b[1].answered)[0]
      : undefined;
    return {
      id: s.id,
      name: s.name,
      className: s.className,
      telegram: !!s.telegramChatId,
      status,
      lastDay,
      daysAgo,
      streak: streakFromDays(practiceDays, today).streak,
      week: days.map((d) => !!p?.days.has(d)),
      answered: p?.all.answered ?? 0,
      accuracy: pct(p?.all),
      weakTopic: weak ? { category: weak[0], accuracy: pct(weak[1])! } : null,
    };
  });

  const topics = [...groupTopics.entries()]
    .map(([category, t]) => ({ category, answered: t.answered, correct: t.correct, accuracy: pct(t, MIN_ANSWERS) }))
    .sort((a, b) => (a.accuracy ?? 101) - (b.accuracy ?? 101) || b.answered - a.answered || a.category.localeCompare(b.category, 'ky'));

  const week = rows.reduce<Tally>((t, r) => {
    const p = per.get(r.id);
    return { answered: t.answered + (p?.week.answered ?? 0), correct: t.correct + (p?.week.correct ?? 0) };
  }, { answered: 0, correct: 0 });
  const count = (st: StudentStatus) => rows.filter((r) => r.status === st).length;

  return {
    today,
    days,
    classes,
    className,
    summary: {
      members: rows.length,
      withCode: students.filter((s) => s.accessCode).length,
      activeWeek: rows.filter((r) => r.week.some(Boolean)).length,
      active: count('ACTIVE'),
      stopped: count('STOPPED'),
      never: count('NEVER') + count('NO_CODE'),
      accuracyWeek: pct(week),
    },
    topics,
    students: rows,
  };
}
