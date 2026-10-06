import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { parse as parseCsv } from 'csv-parse/sync';
import { prisma } from '../db.js';
import { assertOwner, ownerKey, requireAdmin, staff } from '../auth.js';
import { AppError, ROUNDS, type Difficulty, type Option, type QuestionType, type Round } from '../types.js';
import { loadFull, roundQuestions } from '../game/load.js';
import { overallStandings, teamStandings } from '../game/scoring.js';
import { TF_OPTIONS } from './questions.js';

export const importExportRouter = Router();
importExportRouter.use(requireAdmin);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const HEADERS = [
  'Тур (1, 2 же Финал)',
  'Түрү (Тандоо / Туура-Туура эмес / Иретке келтирүү)',
  'Тема',
  'Кыйынчылык (Жеңил / Орто / Кыйын)',
  'Суроо',
  'А',
  'Б',
  'В',
  'Г',
  'Туура жооп',
  'Сүрөт шилтемеси (милдеттүү эмес)',
];
const EXAMPLES = [
  ['1', 'Тандоо', 'География', 'Жеңил', 'Кыргызстандын борбор шаары кайсы?', 'Ош', 'Бишкек', 'Каракол', 'Нарын', 'Б', ''],
  ['2', 'Туура / Туура эмес', 'Илим', 'Орто', 'Суу 100 °C’да кайнайт.', '', '', '', '', 'Туура', ''],
  ['Финал', 'Иретке келтирүү', 'Тарых', 'Кыйын', 'Окуяларды убакыт боюнча иреттеңиз', 'Эгемендүүлүк', 'Бурана курулушу', '«Манас» биринчи жазылышы', 'Сулайман-Тоо ЮНЕСКОдо', 'БВАГ', ''],
];

const ROUND_LABEL: Record<Round, string> = { ROUND1: '1-тур', ROUND2: '2-тур', FINAL: 'Финал' };
const TYPE_LABEL: Record<QuestionType, string> = { CHOICE: 'Тандоо', TF: 'Туура / Туура эмес', ORDER: 'Иретке келтирүү' };
const DIFF_LABEL: Record<Difficulty, string> = { EASY: 'Жеңил', MEDIUM: 'Орто', HARD: 'Кыйын' };
const OPT_KY: Record<Option, string> = { A: 'А', B: 'Б', C: 'В', D: 'Г' };
const LETTER: Record<string, Option> = { А: 'A', A: 'A', Б: 'B', B: 'B', В: 'C', C: 'C', Г: 'D', D: 'D', '1': 'A', '2': 'B', '3': 'C', '4': 'D' };

/** Жоопту адамга түшүнүктүү кылып жазуу: «Б», «Туура», «ВАГБ» */
export function correctLabel(type: string, correct: string): string {
  if (type === 'TF') return correct === 'A' ? 'Туура' : 'Туура эмес';
  return [...correct].map((l) => OPT_KY[l as Option] ?? l).join('');
}

function parseRound(v: string): Round | null {
  const s = v.trim().toLowerCase().replace(/[-\s]*тур$/, '');
  if (['1', 'i', 'round1'].includes(s)) return 'ROUND1';
  if (['2', 'ii', 'round2'].includes(s)) return 'ROUND2';
  if (['3', 'ф', 'финал', 'final', 'f'].includes(s)) return 'FINAL';
  return null;
}

function parseType(v: string): QuestionType | null {
  const s = v.trim().toLowerCase();
  // Кыргызча, орусча жана англисче аталыштар кабыл алынат
  if (!s || s.startsWith('танд') || s.startsWith('выбор') || s === 'choice') return 'CHOICE';
  if (s.startsWith('туура') || s.startsWith('верно') || s === 'tf' || s.includes('true')) return 'TF';
  if (s.startsWith('ирет') || s.startsWith('тартип') || s.startsWith('поряд') || s === 'order') return 'ORDER';
  return null;
}

function parseDifficulty(v: string): Difficulty | null {
  const s = v.trim().toLowerCase();
  if (!s || s.startsWith('орто') || s.startsWith('сред') || s === 'medium' || s === '2') return 'MEDIUM';
  if (s.startsWith('жеңил') || s.startsWith('л') || s === 'easy' || s === '1') return 'EASY';
  if (s.startsWith('кыйын') || s.startsWith('слож') || s === 'hard' || s === '3') return 'HARD';
  return null;
}

function parseCorrect(type: QuestionType, v: string): string | null {
  const s = v.trim().toUpperCase();
  if (type === 'TF') {
    if (['ТУУРА', 'А', 'A', 'TRUE', 'ООБА', 'ВЕРНО', 'ДА', '1'].includes(s)) return 'A';
    if (['ТУУРА ЭМЕС', 'Б', 'B', 'FALSE', 'ЖОК', 'НЕВЕРНО', 'НЕТ', '2'].includes(s)) return 'B';
    return null;
  }
  if (type === 'ORDER') {
    const letters = [...s.replace(/[\s,;→>-]+/g, '')].map((c) => LETTER[c]);
    const order = letters.join('');
    return letters.length === 4 && [...order].sort().join('') === 'ABCD' ? order : null;
  }
  return LETTER[s] ?? null;
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
      for (let c = 1; c <= 11; c++) cells.push(row.getCell(c).text ?? '');
      rows.push(cells);
    });
    return rows;
  }
  throw new AppError('INVALID_FILE');
}

function styleHeader(ws: ExcelJS.Worksheet) {
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8102E' } };
  h.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

const QUESTION_WIDTHS = [12, 22, 16, 14, 60, 22, 22, 22, 22, 14, 30];

function sendXlsx(res: import('express').Response, wb: ExcelJS.Workbook, filename: string) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  return wb.xlsx.write(res).then(() => res.end());
}

/** Шаблон: Excel (.xlsx) */
importExportRouter.get('/questions/template.xlsx', async (_req, res) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Суроолор');
  ws.addRow(HEADERS);
  EXAMPLES.forEach((r) => ws.addRow(r));
  ws.columns = QUESTION_WIDTHS.map((width) => ({ width }));
  styleHeader(ws);
  await sendXlsx(res, wb, 'суроолор-шаблон.xlsx');
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
 * Суроолор банкын Excel’ге жүктөп алуу (резервдик көчүрмө же башка мугалим менен бөлүшүү үчүн).
 * 1-барак — банк (кайра импорттоого болот), 2-барак — архив.
 */
importExportRouter.get('/questions/export.xlsx', async (_req, res) => {
  const all = await prisma.question.findMany({ where: { ownerId: ownerKey(staff(res)) }, orderBy: [{ round: 'asc' }, { order: 'asc' }] });
  const sorted = [...all].sort((a, b) => ROUNDS.indexOf(a.round as Round) - ROUNDS.indexOf(b.round as Round) || a.order - b.order);
  const row = (q: (typeof all)[number]) => [
    ROUND_LABEL[q.round as Round],
    TYPE_LABEL[q.type as QuestionType] ?? q.type,
    q.category,
    DIFF_LABEL[q.difficulty as Difficulty] ?? q.difficulty,
    q.text,
    q.type === 'TF' ? '' : q.optionA,
    q.type === 'TF' ? '' : q.optionB,
    q.optionC,
    q.optionD,
    correctLabel(q.type, q.correct),
    q.imageUrl ?? '',
  ];
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Тапкыч ордо';
  const ws1 = wb.addWorksheet('Банк');
  ws1.addRow(HEADERS);
  sorted.filter((q) => !q.archived).forEach((q) => ws1.addRow(row(q)));
  ws1.columns = QUESTION_WIDTHS.map((width) => ({ width }));
  styleHeader(ws1);
  const ws2 = wb.addWorksheet('Архив');
  ws2.addRow([...HEADERS, 'Канча жолу суралган', 'Акыркы жолу']);
  sorted
    .filter((q) => q.archived)
    .forEach((q) => ws2.addRow([...row(q), q.usedCount, q.lastUsedAt ? q.lastUsedAt.toISOString().slice(0, 10) : '']));
  ws2.columns = [...QUESTION_WIDTHS, 14, 14].map((width) => ({ width }));
  styleHeader(ws2);
  await sendXlsx(res, wb, `тапкыч-ордо-суроолор-${new Date().toISOString().slice(0, 10)}.xlsx`);
});

/**
 * Импорт. ?dryRun=1 — сактабай, текшерүүнүн жыйынтыгын гана кайтарат (алдын ала көрүү).
 * ?replace=1 — банктагы активдүү суроолорду алмаштырат (архив сакталат).
 * Эски (8 мамычалуу) шаблон да кабыл алынат.
 */
importExportRouter.post('/questions/import', upload.single('file'), async (req, res) => {
  if (!req.file) throw new AppError('INVALID_FILE');
  const rows = await readRows(req.file);
  const hasHeader = rows.length > 0 && !parseRound(rows[0][0] ?? '');
  // Жаңы шаблондо 2-мамыча — «Түрү»
  const newFormat = !hasHeader || (rows[0][1] ?? '').trim().toLowerCase().startsWith('түр');
  const body = hasHeader ? rows.slice(1) : rows;

  type Parsed = {
    round: Round;
    type: QuestionType;
    category: string;
    difficulty: Difficulty;
    text: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correct: string;
    imageUrl: string | null;
  };
  const valid: Parsed[] = [];
  const errors: { row: number; problem: string }[] = [];

  body.forEach((r, i) => {
    const rowNo = i + (hasHeader ? 2 : 1);
    const cells = r.map((x) => String(x ?? '').trim());
    const [roundRaw = '', typeRaw = '', category = '', diffRaw = '', text = '', a = '', b = '', c = '', d = '', correctRaw = '', img = ''] = newFormat
      ? cells
      : [cells[0], '', '', '', cells[1], cells[2], cells[3], cells[4], cells[5], cells[6], cells[7]];
    if (![roundRaw, text, a, b, c, d, correctRaw].some(Boolean)) return; // бош сап
    const round = parseRound(roundRaw);
    const type = parseType(typeRaw);
    const difficulty = parseDifficulty(diffRaw);
    if (!round) return errors.push({ row: rowNo, problem: 'ROUND' });
    if (!type) return errors.push({ row: rowNo, problem: 'TYPE' });
    if (!difficulty) return errors.push({ row: rowNo, problem: 'DIFFICULTY' });
    if (!text) return errors.push({ row: rowNo, problem: 'TEXT' });
    if (type !== 'TF' && (!a || !b || !c || !d)) return errors.push({ row: rowNo, problem: 'OPTIONS' });
    const correct = parseCorrect(type, correctRaw);
    if (!correct) return errors.push({ row: rowNo, problem: 'CORRECT' });
    const opts = type === 'TF' ? TF_OPTIONS : { optionA: a, optionB: b, optionC: c, optionD: d };
    valid.push({ round, type, category: category.slice(0, 40), difficulty, text, ...opts, correct, imageUrl: img || null });
  });

  const counts = Object.fromEntries(ROUNDS.map((r) => [r, valid.filter((v) => v.round === r).length]));

  if (req.query.dryRun === '1' || (errors.length > 0 && req.query.force !== '1')) {
    res.json({ dryRun: true, valid: valid.length, counts, errors, preview: valid.slice(0, 50) });
    return;
  }

  const ownerId = ownerKey(staff(res));
  const replace = req.query.replace === '1';
  await prisma.$transaction(async (tx) => {
    // Архив (мурунку оюндарда суралгандар) сакталат — банктагы активдүү суроолор гана алмаштырылат
    if (replace) await tx.question.deleteMany({ where: { ownerId, archived: false } });
    for (const round of ROUNDS) {
      const last = await tx.question.findFirst({ where: { ownerId, round, archived: false }, orderBy: { order: 'desc' } });
      let order = (last?.order ?? -1) + 1;
      const items = valid.filter((v) => v.round === round).map((v) => ({ ...v, ownerId, order: order++ }));
      if (items.length) await tx.question.createMany({ data: items });
    }
  });
  res.json({ dryRun: false, imported: valid.length, counts, errors });
});

/** Оюндун толук жыйынтыгы Excel'де: жыйынтык, ар бир суроо боюнча жооптор, суроолор */
importExportRouter.get('/games/:id/export.xlsx', async (req, res) => {
  const game = await loadFull(Number(req.params.id));
  if (!game) throw new AppError('GAME_NOT_FOUND', 404);
  assertOwner(staff(res), game.ownerId);
  const standings = overallStandings(game);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Тапкыч ордо';

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
    ws.addRow(['Аты-жөнү', ...qs.map((q) => `№${q.order + 1} (туура: ${correctLabel(q.type, q.correct)})`), 'Упай']);
    const players = game.players.filter((p) => qs.some((q) => q.answers.some((a) => a.playerId === p.id)) || p.status !== 'KICKED');
    for (const p of players) {
      if (p.eliminatedAfter && ROUNDS.indexOf(p.eliminatedAfter as Round) < ROUNDS.indexOf(round)) continue;
      const cells = qs.map((q) => {
        const a = q.answers.find((x) => x.playerId === p.id);
        return a ? `${correctLabel(q.type, a.choice)} ${a.isCorrect ? '✓' : '✗'}${a.bonus ? ` +${a.bonus}` : ''} (${sec(a.responseMs)} с)` : '—';
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
  ws3.addRow(['Тур', '№', 'Түрү', 'Тема', 'Суроо', 'А', 'Б', 'В', 'Г', 'Туура жооп', 'Туура жооп бергендер', 'Жооп бергендер', 'Залдын добуштары']);
  const ordered = [...game.questions].sort((a, b) => ROUNDS.indexOf(a.round as Round) - ROUNDS.indexOf(b.round as Round) || a.order - b.order);
  for (const q of ordered) {
    ws3.addRow([
      ROUND_LABEL[q.round as Round],
      q.order + 1,
      TYPE_LABEL[q.type as QuestionType] ?? q.type,
      q.category,
      q.text,
      q.optionA,
      q.optionB,
      q.optionC,
      q.optionD,
      correctLabel(q.type, q.correct),
      q.answers.filter((a) => a.isCorrect).length,
      q.answers.length,
      q.votes.length,
    ]);
  }
  ws3.columns.forEach((c, i) => (c.width = i === 4 ? 60 : i >= 5 && i <= 8 ? 20 : 12));
  styleHeader(ws3);

  // Командалык режим: класстардын жыйынтыгы
  if (game.teamMode) {
    const ws4 = wb.addWorksheet('Командалар');
    ws4.addRow(['Орун', 'Команда (класс)', 'Оюнчулар', 'Жалпы упай', 'Орточо упай', 'Туура жооптор']);
    for (const t of teamStandings(game)) ws4.addRow([t.place, t.team, t.members, t.total, t.average, t.correct]);
    ws4.columns.forEach((c, i) => (c.width = i === 1 ? 24 : 14));
    styleHeader(ws4);
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`тапкыч-ордо-${game.code}.xlsx`)}`);
  await wb.xlsx.write(res);
  res.end();
});
