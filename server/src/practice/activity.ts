import { prisma } from '../db.js';

/**
 * Студенттердин өз алдынча машыгуусу боюнча эсептөөлөр: күндөр, серия (streak) жана
 * топтор арасындагы жумалык рейтинг (студенттин кабинети жана мугалимдин Dashboard'у үчүн).
 */

/** Күндүн белгиси Бишкек убактысы (UTC+6) боюнча: түн ортосунда жаңы күн */
export function bishkekDay(now = Date.now()): string {
  return new Date(now + 6 * 3600_000).toISOString().slice(0, 10);
}

export const prevDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86400_000).toISOString().slice(0, 10);

/** Акыркы n күн (бүгүнкү күн акыркы), эскиден жаңыга */
export function lastDays(n: number, today = bishkekDay()): string[] {
  const days: string[] = [];
  for (let d = today, i = 0; i < n; i++, d = prevDay(d)) days.unshift(d);
  return days;
}

/** Серия: бүгүн (же бүгүн али аткара элек болсо — кечээ) аяктаган катар күндөр; best — эң узун серия */
export function streakFromDays(daysDone: Iterable<string>, today = bishkekDay()): { streak: number; best: number } {
  const set = new Set(daysDone);
  let cursor = set.has(today) ? today : prevDay(today);
  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    cursor = prevDay(cursor);
  }
  let best = 0;
  let run = 0;
  let last: string | null = null;
  for (const d of [...set].sort()) {
    run = last && prevDay(d) === last ? run + 1 : 1;
    best = Math.max(best, run);
    last = d;
  }
  return { streak, best };
}

export const WEEK = 7;

export interface GroupActivity {
  className: string;
  members: number;
  /** Жумада жок дегенде бир жолу «Күндүн суроолорун» аткаргандар */
  active: number;
  /** Аткарылган «Күндүн суроолору» (студент × күн) */
  completions: number;
  /** Активдүүлүк, %: completions / (members × 7) */
  activity: number;
  /** Туура жооптордун пайызы (күндүн суроолору боюнча) */
  accuracy: number;
  place: number;
}

export interface StreakRow {
  studentId: number;
  name: string;
  className: string;
  streak: number;
}

/**
 * Топтордун жумалык рейтинги (акыркы 7 күн) жана серия чемпиондору.
 * Топсуз студенттер топтор рейтингине кирбейт, бирок серия чемпиондоруна кирет.
 */
export async function practiceLeaderboard(topStreaks = 10) {
  const days = lastDays(WEEK);
  const from = days[0];
  const [students, attempts] = await Promise.all([
    prisma.student.findMany({ select: { id: true, name: true, className: true } }),
    prisma.practiceAttempt.findMany({ where: { kind: 'DAILY' }, select: { studentId: true, day: true, correct: true, total: true } }),
  ]);

  const byStudent = new Map<number, typeof attempts>();
  for (const a of attempts) byStudent.set(a.studentId, [...(byStudent.get(a.studentId) ?? []), a]);

  const groups = new Map<string, Omit<GroupActivity, 'activity' | 'accuracy' | 'place'> & { correct: number; total: number }>();
  for (const s of students) {
    if (!s.className) continue;
    const g = groups.get(s.className) ?? { className: s.className, members: 0, active: 0, completions: 0, correct: 0, total: 0 };
    g.members++;
    const week = (byStudent.get(s.id) ?? []).filter((a) => a.day >= from);
    if (week.length) g.active++;
    g.completions += week.length;
    g.correct += week.reduce((n, a) => n + a.correct, 0);
    g.total += week.reduce((n, a) => n + a.total, 0);
    groups.set(s.className, g);
  }
  const ranked: GroupActivity[] = [...groups.values()]
    .map(({ correct, total, ...g }) => ({
      ...g,
      activity: Math.round((g.completions / (g.members * WEEK)) * 100),
      accuracy: total ? Math.round((correct / total) * 100) : 0,
      place: 0,
    }))
    .sort((a, b) => b.activity - a.activity || b.accuracy - a.accuracy || a.className.localeCompare(b.className, 'ky'));
  ranked.forEach((g, i) => (g.place = i + 1));

  const streaks: StreakRow[] = students
    .map((s) => ({ studentId: s.id, name: s.name, className: s.className, streak: streakFromDays((byStudent.get(s.id) ?? []).map((a) => a.day)).streak }))
    .filter((r) => r.streak > 0)
    .sort((a, b) => b.streak - a.streak || a.name.localeCompare(b.name, 'ky'))
    .slice(0, topStreaks);

  return { from, to: days[days.length - 1], groups: ranked, streaks };
}
