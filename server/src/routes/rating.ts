import { Router } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../db.js';
import { requireAdmin } from '../auth.js';
import { bus } from '../events.js';
import { AppError } from '../types.js';
import { overallStandings } from '../game/scoring.js';
import type { FullGame } from '../game/load.js';

/**
 * Бардык бүткөн оюндар жана үй тапшырмалары боюнча студенттердин рейтинги.
 * Ачык бет (логинсиз) — проекторго же окуу жайынын сайтына чыгарса болот.
 */
export const ratingRouter = Router();

export interface RatingRow {
  studentId: number;
  name: string;
  className: string;
  games: number;
  tasks: number;
  wins: number;
  podiums: number;
  finals: number;
  totalScore: number;
  correct: number;
  answered: number;
  accuracy: number; // 0..100
  bestPlace: number | null;
  lastPlayedAt: string | null;
}

interface GameEntry {
  gameId: number;
  title: string | null;
  date: string;
  place: number;
  players: number;
  total: number;
  reached: string;
  correct: number;
  answered: number;
}
interface TaskEntry {
  assignmentId: number;
  title: string;
  date: string;
  score: number;
  correct: number;
  total: number;
}
interface StudentDetail {
  games: GameEntry[];
  tasks: TaskEntry[];
  categories: Map<string, { correct: number; answered: number }>;
}

interface Computed {
  at: number;
  rows: RatingRow[];
  games: number;
  tasks: number;
  details: Map<number, StudentDetail>;
}

const cache = new Map<string, Computed>();
// Оюнда же тапшырмада бир нерсе өзгөрсө — кийинки сурамда кайра эсептейбиз
bus.on('game:changed', () => cache.clear());
bus.on('rating:changed', () => cache.clear());

async function computeRating(seasonId?: number): Promise<Computed> {
  const key = String(seasonId ?? 'all');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit;

  const season = seasonId ? await prisma.season.findUnique({ where: { id: seasonId } }) : null;
  if (seasonId && !season) throw new AppError('NOT_FOUND', 404);
  const range = season ? { gte: season.startsAt, lte: season.endsAt } : undefined;

  const [games, submissions, students] = await Promise.all([
    prisma.game.findMany({
      where: { status: 'FINISHED', ...(range ? { finishedAt: range } : {}) },
      orderBy: { finishedAt: 'asc' },
      include: {
        players: { orderBy: { seat: 'asc' } },
        questions: { orderBy: [{ round: 'asc' }, { order: 'asc' }], include: { answers: true, votes: true } },
        adjustments: true,
      },
    }) as Promise<FullGame[]>,
    prisma.submission.findMany({
      where: { finishedAt: range ?? { not: null }, studentId: { not: null } },
      include: { assignment: { select: { id: true, title: true, _count: { select: { questions: true } } } } },
      orderBy: { finishedAt: 'asc' },
    }),
    prisma.student.findMany(),
  ]);

  const rows = new Map<number, RatingRow>();
  const details = new Map<number, StudentDetail>();
  for (const s of students) {
    rows.set(s.id, {
      studentId: s.id, name: s.name, className: s.className, games: 0, tasks: 0, wins: 0, podiums: 0, finals: 0,
      totalScore: 0, correct: 0, answered: 0, accuracy: 0, bestPlace: null, lastPlayedAt: null,
    });
    details.set(s.id, { games: [], tasks: [], categories: new Map() });
  }
  const touch = (row: RatingRow, when: string) => {
    if (!row.lastPlayedAt || when > row.lastPlayedAt) row.lastPlayedAt = when;
  };

  for (const game of games) {
    const standings = overallStandings(game);
    const playersCount = standings.length;
    for (const s of standings) {
      const player = game.players.find((p) => p.id === s.playerId);
      const row = player?.studentId ? rows.get(player.studentId) : undefined;
      const det = player?.studentId ? details.get(player.studentId) : undefined;
      if (!row || !det) continue;
      row.games++;
      row.totalScore += s.total;
      if (s.place === 1) row.wins++;
      if (s.place <= 3) row.podiums++;
      if (s.reached === 'FINAL') row.finals++;
      row.bestPlace = row.bestPlace === null ? s.place : Math.min(row.bestPlace, s.place);
      const when = (game.finishedAt ?? game.createdAt).toISOString();
      touch(row, when);
      let correct = 0;
      let answered = 0;
      for (const q of game.questions) {
        const a = q.answers.find((x) => x.playerId === s.playerId);
        if (q.startedAt && (a || s.rounds[q.round as keyof typeof s.rounds])) {
          answered++;
          if (a?.isCorrect) correct++;
          const cat = det.categories.get(q.category) ?? { correct: 0, answered: 0 };
          cat.answered++;
          if (a?.isCorrect) cat.correct++;
          det.categories.set(q.category, cat);
        }
      }
      row.correct += correct;
      row.answered += answered;
      det.games.push({ gameId: game.id, title: game.title, date: when, place: s.place, players: playersCount, total: s.total, reached: s.reached, correct, answered });
    }
  }

  for (const sub of submissions) {
    const row = sub.studentId ? rows.get(sub.studentId) : undefined;
    const det = sub.studentId ? details.get(sub.studentId) : undefined;
    if (!row || !det || !sub.finishedAt) continue;
    const total = sub.assignment._count.questions;
    row.tasks++;
    row.totalScore += sub.score;
    row.correct += sub.correct;
    row.answered += total;
    touch(row, sub.finishedAt.toISOString());
    det.tasks.push({ assignmentId: sub.assignment.id, title: sub.assignment.title, date: sub.finishedAt.toISOString(), score: sub.score, correct: sub.correct, total });
  }

  const list = [...rows.values()]
    .filter((r) => r.games > 0 || r.tasks > 0)
    .map((r) => ({ ...r, accuracy: r.answered ? Math.round((r.correct / r.answered) * 100) : 0 }))
    // Эреже: жалпы упай → жеңиштер → тактык → аты
    .sort((a, b) => b.totalScore - a.totalScore || b.wins - a.wins || b.accuracy - a.accuracy || a.name.localeCompare(b.name, 'ky'));

  const result: Computed = { at: Date.now(), rows: list, games: games.length, tasks: new Set(submissions.map((s) => s.assignmentId)).size, details };
  cache.set(key, result);
  return result;
}

const seasonParam = (q: unknown) => {
  const n = Number(q);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

ratingRouter.get('/', async (req, res) => {
  const { rows, games, tasks } = await computeRating(seasonParam(req.query.seasonId));
  const className = typeof req.query.className === 'string' ? req.query.className : '';
  const classes = [...new Set(rows.map((r) => r.className).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ky', { numeric: true }));
  res.json({ rows: className ? rows.filter((r) => r.className === className) : rows, classes, games, tasks });
});

/** Студенттин жеке баракчасы: оюндары, упайынын өсүшү, күчтүү темалары, медалдары */
ratingRouter.get('/student/:id', async (req, res) => {
  const id = Number(req.params.id);
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) throw new AppError('NOT_FOUND', 404);
  const { rows, details } = await computeRating(seasonParam(req.query.seasonId));
  const index = rows.findIndex((r) => r.studentId === id);
  const det = details.get(id) ?? { games: [], tasks: [], categories: new Map() };
  // Убакыт сызыгы: ар бир оюн жана тапшырма боюнча топтолгон упай
  const events = [
    ...det.games.map((g) => ({ date: g.date, kind: 'game' as const, title: g.title, score: g.total })),
    ...det.tasks.map((t) => ({ date: t.date, kind: 'task' as const, title: t.title, score: t.score })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  let cumulative = 0;
  const timeline = events.map((e) => ({ ...e, cumulative: (cumulative += e.score) }));
  res.json({
    student: { id: student.id, name: student.name, className: student.className },
    rank: index >= 0 ? index + 1 : null,
    of: rows.length,
    stats: rows[index] ?? null,
    games: [...det.games].reverse(),
    tasks: [...det.tasks].reverse(),
    timeline,
    categories: [...det.categories.entries()]
      .map(([category, c]) => ({ category, ...c, accuracy: c.answered ? Math.round((c.correct / c.answered) * 100) : 0 }))
      .sort((a, b) => b.accuracy - a.accuracy || b.answered - a.answered),
  });
});

ratingRouter.get('/export.xlsx', requireAdmin, async (req, res) => {
  const { rows } = await computeRating(seasonParam(req.query.seasonId));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Рейтинг');
  ws.addRow(['Орун', 'Аты-жөнү', 'Тобу', 'Оюндар', 'Тапшырмалар', 'Жеңиштер', '1-3-орундар', 'Финалга чыккан', 'Жалпы упай', 'Туура жооптор', 'Тактык (%)', 'Эң жакшы орун']);
  rows.forEach((r, i) =>
    ws.addRow([i + 1, r.name, r.className, r.games, r.tasks, r.wins, r.podiums, r.finals, r.totalScore, `${r.correct}/${r.answered}`, r.accuracy, r.bestPlace ?? '']),
  );
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8102E' } };
  ws.columns.forEach((c, i) => (c.width = i === 1 ? 30 : 14));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('тапкыч-ордо-рейтинг.xlsx')}`);
  await wb.xlsx.write(res);
  res.end();
});

