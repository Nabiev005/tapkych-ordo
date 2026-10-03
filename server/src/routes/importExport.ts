import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { parse as parseCsv } from 'csv-parse/sync';
import { prisma } from '../db.js';
import { requireAdmin } from '../auth.js';
import { AppError, ROUNDS, type Option, type Round } from '../types.js';
import { loadFull, roundQuestions } from '../game/load.js';
import { overallStandings } from '../game/scoring.js';

export const importExportRouter = Router();
importExportRouter.use(requireAdmin);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const HEADERS = ['Тур (1, 2 же Финал)', 'Суроо', 'А', 'Б', 'В', 'Г', 'Туура жооп (А/Б/В/Г)', 'Сүрөт шилтемеси (милдеттүү эмес)'];
const EXAMPLES = [
  ['1', 'Кыргызстандын борбор шаары кайсы?', 'Ош', 'Бишкек', 'Каракол', 'Нарын', 'Б', ''],
  ['2', 'Суунун химиялык формуласы кандай?', 'CO₂', 'O₂', 'H₂O', 'NaCl', 'В', ''],
  ['Финал', '«Кутадгу билиг» чыгармасынын автору ким?', 'Махмуд Кашгари', 'Жусуп Баласагын', 'Алишер Навои', 'Абай', 'Б', ''],
];

const ROUND_LABEL: Record<Round, string> = { ROUND1: '1-тур', ROUND2: '2-тур', FINAL: 'Финал' };
const OPT_KY: Record<Option, string> = { A: 'А', B: 'Б', C: 'В', D: 'Г' };

function parseRound(v: string): Round | null {
  const s = v.trim().toLowerCase().replace(/[-\s]*тур$/, '');
  if (['1', 'i', 'round1'].includes(s)) return 'ROUND1';
  if (['2', 'ii', 'round2'].includes(s)) return 'ROUND2';
  if (['3', 'ф', 'финал', 'final', 'f'].includes(s)) return 'FINAL';
  return null;
}

function parseCorrect(v: string): Option | null {
  const s = v.trim().toUpperCase();
  const map: Record<string, Option> = { А: 'A', A: 'A', Б: 'B', B: 'B', В: 'C', C: 'C', Г: 'D', D: 'D', '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
  return map[s] ?? null;
}

async function readRows(file: Express.Multer.File): Promise<string[][]> {
  const name = file.originalname.toLowerCase();
  if (name.endsWith('.csv')) {
    const text = file.buffer.toString('utf8').replace(/^﻿/, '');
    // Excel кээде «;» менен сактайт — экөөн тең кабыл алабыз
    const delimiter = (text.split('\n')[0].match(/;/g)?.length ?? 0) > (text.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ',';
    return parseCsv(text, { delimiter, relax_column_count: true, skip_empty_lines: true }) as string[][];
  }
  if (name.endsWith('.xlsx')) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) return [];
    const rows: string[][] = [];
    ws.eachRow((row) => {
      const cells: string[] = [];
      for (let c = 1; c <= 8; c++) cells.push(row.getCell(c).text ?? '');
      rows.push(cells);
    });
    return rows;
  }
  throw new AppError('INVALID_FILE');
}

/** Шаблон: Excel (.xlsx) */
importExportRouter.get('/questions/template.xlsx', async (_req, res) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Суроолор');
  ws.addRow(HEADERS);
  EXAMPLES.forEach((r) => ws.addRow(r));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8102E' } };
  ws.columns = [{ width: 18 }, { width: 60 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 30 }];
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('суроолор-шаблон.xlsx')}`);
  await wb.xlsx.write(res);
  res.end();
});

/** Шаблон: CSV */
importExportRouter.get('/questions/template.csv', (_req, res) => {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const csv = '﻿' + [HEADERS, ...EXAMPLES].map((r) => r.map(esc).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('суроолор-шаблон.csv')}`);
  res.send(csv);
});

/**
 * Импорт. ?dryRun=1 — сактабай, текшерүүнүн жыйынтыгын гана кайтарат (алдын ала көрүү).
 * ?replace=1 — мурунку бардык суроолорду өчүрүп, жаңыларын жазат.
 */
importExportRouter.post('/questions/import', upload.single('file'), async (req, res) => {
  if (!req.file) throw new AppError('INVALID_FILE');
  const rows = await readRows(req.file);
  // Биринчи сап — аталыштар (эгер биринчи уячада тур болбосо)
  const body = rows.length && !parseRound(rows[0][0] ?? '') ? rows.slice(1) : rows;

  type Parsed = { round: Round; text: string; optionA: string; optionB: string; optionC: string; optionD: string; correct: Option; imageUrl: string | null };
  const valid: Parsed[] = [];
  const errors: { row: number; problem: string }[] = [];

  body.forEach((r, i) => {
    const rowNo = i + (body === rows ? 1 : 2);
    const [roundRaw = '', text = '', a = '', b = '', c = '', d = '', correctRaw = '', img = ''] = r.map((x) => String(x ?? '').trim());
    if (![roundRaw, text, a, b, c, d, correctRaw].some(Boolean)) return; // бош сап
    const round = parseRound(roundRaw);
    const correct = parseCorrect(correctRaw);
    if (!round) return errors.push({ row: rowNo, problem: 'ROUND' });
    if (!text) return errors.push({ row: rowNo, problem: 'TEXT' });
    if (!a || !b || !c || !d) return errors.push({ row: rowNo, problem: 'OPTIONS' });
    if (!correct) return errors.push({ row: rowNo, problem: 'CORRECT' });
    valid.push({ round, text, optionA: a, optionB: b, optionC: c, optionD: d, correct, imageUrl: img || null });
  });

  const counts = Object.fromEntries(ROUNDS.map((r) => [r, valid.filter((v) => v.round === r).length]));

  if (req.query.dryRun === '1' || errors.length > 0 && req.query.force !== '1') {
    res.json({ dryRun: true, valid: valid.length, counts, errors, preview: valid.slice(0, 50) });
    return;
  }

  const replace = req.query.replace === '1';
  await prisma.$transaction(async (tx) => {
    if (replace) await tx.question.deleteMany();
    for (const round of ROUNDS) {
      const last = await tx.question.findFirst({ where: { round }, orderBy: { order: 'desc' } });
      let order = (last?.order ?? -1) + 1;
      const items = valid.filter((v) => v.round === round).map((v) => ({ ...v, order: order++ }));
      if (items.length) await tx.question.createMany({ data: items });
    }
  });
  res.json({ dryRun: false, imported: valid.length, counts, errors });
});

/** Оюндун толук жыйынтыгы Excel'де: жыйынтык, ар бир суроо боюнча жооптор, суроолор */
importExportRouter.get('/games/:id/export.xlsx', async (req, res) => {
  const game = await loadFull(Number(req.params.id));
  if (!game) throw new AppError('GAME_NOT_FOUND', 404);
  const standings = overallStandings(game);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Тапкыч ордо';

  const styleHeader = (ws: ExcelJS.Worksheet) => {
    const h = ws.getRow(1);
    h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8102E' } };
    h.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  };
  const sec = (ms?: number) => (ms === undefined ? '' : Math.round(ms / 100) / 10);

  // 1. Жыйынтык
  const ws1 = wb.addWorksheet('Жыйынтык');
  ws1.addRow(['Орун', 'Аты-жөнү', '1-тур упай', '1-тур убакыт (сек)', '2-тур упай', '2-тур убакыт (сек)', 'Финал упай', 'Финал убакыт (сек)', 'Жалпы упай', 'Жеткен тур']);
  for (const s of standings) {
    ws1.addRow([
      s.place,
      s.name,
      s.rounds.ROUND1?.score ?? '',
      sec(s.rounds.ROUND1?.timeMs),
      s.rounds.ROUND2?.score ?? '',
      sec(s.rounds.ROUND2?.timeMs),
      s.rounds.FINAL?.score ?? '',
      sec(s.rounds.FINAL?.timeMs),
      s.total,
      ROUND_LABEL[s.reached],
    ]);
  }
  ws1.columns.forEach((c, i) => (c.width = i === 1 ? 30 : 14));
  styleHeader(ws1);
  [1, 2, 3].forEach((p) => {
    const row = ws1.getRow(p + 1);
    if (row.getCell(1).value === p) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ['FFFFE08A', 'FFE5E7EB', 'FFF5C9A0'][p - 1] } };
  });

  // 2. Жооптор: ар бир турга өзүнчө барак — саптар оюнчулар, мамычалар суроолор
  for (const round of ROUNDS) {
    const qs = roundQuestions(game, round).filter((q) => q.startedAt);
    if (!qs.length) continue;
    const ws = wb.addWorksheet(`Жооптор — ${ROUND_LABEL[round]}`);
    ws.addRow(['Аты-жөнү', ...qs.map((q) => `№${q.order + 1} (туура: ${OPT_KY[q.correct as Option]})`), 'Упай']);
    const players = game.players.filter((p) => qs.some((q) => q.answers.some((a) => a.playerId === p.id)) || p.status !== 'KICKED');
    for (const p of players) {
      if (p.eliminatedAfter && ROUNDS.indexOf(p.eliminatedAfter as Round) < ROUNDS.indexOf(round)) continue;
      const cells = qs.map((q) => {
        const a = q.answers.find((x) => x.playerId === p.id);
        return a ? `${OPT_KY[a.choice as Option]} ${a.isCorrect ? '✓' : '✗'} (${sec(a.responseMs)} с)` : '—';
      });
      const pts = qs.reduce((s, q) => s + (q.answers.find((x) => x.playerId === p.id)?.points ?? 0), 0);
      const adj = game.adjustments.filter((x) => x.playerId === p.id && x.round === round).reduce((s, x) => s + x.delta, 0);
      const row = ws.addRow([p.name + (p.status === 'KICKED' ? ' (чыгарылган)' : ''), ...cells, pts + adj]);
      cells.forEach((c, i) => {
        const cell = row.getCell(i + 2);
        if (c.includes('✓')) cell.font = { color: { argb: 'FF15803D' } };
        else if (c.includes('✗')) cell.font = { color: { argb: 'FFB91C1C' } };
      });
    }
    ws.columns.forEach((c, i) => (c.width = i === 0 ? 30 : 16));
    styleHeader(ws);
  }

  // 3. Суроолор
  const ws3 = wb.addWorksheet('Суроолор');
  ws3.addRow(['Тур', '№', 'Суроо', 'А', 'Б', 'В', 'Г', 'Туура жооп', 'Туура жооп бергендер', 'Жооп бергендер']);
  for (const q of game.questions) {
    ws3.addRow([
      ROUND_LABEL[q.round as Round],
      q.order + 1,
      q.text,
      q.optionA,
      q.optionB,
      q.optionC,
      q.optionD,
      OPT_KY[q.correct as Option],
      q.answers.filter((a) => a.isCorrect).length,
      q.answers.length,
    ]);
  }
  ws3.columns.forEach((c, i) => (c.width = i === 2 ? 60 : i >= 3 && i <= 6 ? 20 : 12));
  styleHeader(ws3);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`тапкыч-ордо-${game.code}.xlsx`)}`);
  await wb.xlsx.write(res);
  res.end();
});
