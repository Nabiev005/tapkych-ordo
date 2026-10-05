import { Router } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../db.js';
import { requireAdmin } from '../auth.js';
import { bus } from '../events.js';
import { overallStandings } from '../game/scoring.js';
import type { FullGame } from '../game/load.js';

/**
 * Бардык бүткөн оюндар боюнча окуучулардын рейтинги.
 * Ачык бет (логинсиз) — проекторго же мектептин сайтына чыгарса болот.
 */
export const ratingRouter = Router();

export interface RatingRow {
  studentId: number;
  name: string;
  className: string;
  games: number;
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

let cache: { at: number; rows: RatingRow[]; games: number } | null = null;
// Оюнда бир нерсе өзгөрсө — кийинки сурамда кайра эсептейбиз
bus.on('game:changed', () => (cache = null));

async function computeRating(): Promise<{ rows: RatingRow[]; games: number }> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache;

  const [games, students] = await Promise.all([
    prisma.game.findMany({
      where: { status: 'FINISHED' },
      include: {
        players: { orderBy: { seat: 'asc' } },
        questions: { orderBy: [{ round: 'asc' }, { order: 'asc' }], include: { answers: true } },
        adjustments: true,
      },
    }) as Promise<FullGame[]>,
    prisma.student.findMany(),
  ]);

  const rows = new Map<number, RatingRow>(
    students.map((s) => [
      s.id,
      { studentId: s.id, name: s.name, className: s.className, games: 0, wins: 0, podiums: 0, finals: 0, totalScore: 0, correct: 0, answered: 0, accuracy: 0, bestPlace: null, lastPlayedAt: null },
    ]),
  );

  for (const game of games) {
    for (const s of overallStandings(game)) {
      const player = game.players.find((p) => p.id === s.playerId);
      const row = player?.studentId ? rows.get(player.studentId) : undefined;
      if (!row) continue;
      row.games++;
      row.totalScore += s.total;
      if (s.place === 1) row.wins++;
      if (s.place <= 3) row.podiums++;
      if (s.reached === 'FINAL') row.finals++;
      row.bestPlace = row.bestPlace === null ? s.place : Math.min(row.bestPlace, s.place);
      const when = (game.finishedAt ?? game.createdAt).toISOString();
      if (!row.lastPlayedAt || when > row.lastPlayedAt) row.lastPlayedAt = when;
      for (const q of game.questions) {
        const a = q.answers.find((x) => x.playerId === s.playerId);
        if (q.startedAt && (a || s.rounds[q.round as keyof typeof s.rounds])) {
          row.answered++;
          if (a?.isCorrect) row.correct++;
        }
      }
    }
  }

  const list = [...rows.values()]
    .filter((r) => r.games > 0)
    .map((r) => ({ ...r, accuracy: r.answered ? Math.round((r.correct / r.answered) * 100) : 0 }))
    // Эреже: жалпы упай → жеңиштер → тактык → аты
    .sort((a, b) => b.totalScore - a.totalScore || b.wins - a.wins || b.accuracy - a.accuracy || a.name.localeCompare(b.name, 'ky'));

  cache = { at: Date.now(), rows: list, games: games.length };
  return cache;
}

ratingRouter.get('/', async (req, res) => {
  const { rows, games } = await computeRating();
  const className = typeof req.query.className === 'string' ? req.query.className : '';
  const classes = [...new Set(rows.map((r) => r.className).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ky', { numeric: true }));
  res.json({ rows: className ? rows.filter((r) => r.className === className) : rows, classes, games });
});

ratingRouter.get('/export.xlsx', requireAdmin, async (_req, res) => {
  const { rows } = await computeRating();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Рейтинг');
  ws.addRow(['Орун', 'Аты-жөнү', 'Классы', 'Оюндар', 'Жеңиштер', '1-3-орундар', 'Финалга чыккан', 'Жалпы упай', 'Туура жооптор', 'Тактык (%)', 'Эң жакшы орун']);
  rows.forEach((r, i) =>
    ws.addRow([i + 1, r.name, r.className, r.games, r.wins, r.podiums, r.finals, r.totalScore, `${r.correct}/${r.answered}`, r.accuracy, r.bestPlace ?? '']),
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
