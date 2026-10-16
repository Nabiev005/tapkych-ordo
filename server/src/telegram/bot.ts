import crypto from 'node:crypto';
import { Router } from 'express';
import type { LibraryQuestion } from '@prisma/client';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { bishkekDay } from '../practice/activity.js';
import { dailyQuestions, grade, streakOf, type Detail } from '../routes/me.js';

/**
 * Telegram-бот (акысыз Telegram Bot API). TELEGRAM_BOT_TOKEN коюлбаса — өчүк.
 *  - Студент кабинеттен (/me) «Telegram'га туташтыруу» баскычын басат → t.me/бот?start=КОД → чат студентке байланат
 *  - «Күндүн суроолору» түз Telegram'да: ар бир суроо баскычтар менен, жыйынтык сайттагыдай сакталат
 *  - Кечинде (18:00–22:00, Бишкек) бүгүнкү суроолорду аткара электерге бир жолу эскертме
 * Интернетте (Render) webhook, жергиликтүү компьютерде long polling колдонулат.
 * Суроонун абалы callback_data'да сакталат (сервер кайра иштетилсе да үзүлбөйт).
 */

const TOKEN = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
const API = (process.env.TELEGRAM_API_URL ?? 'https://api.telegram.org').replace(/\/$/, '');
const SITE = (process.env.SITE_URL ?? 'https://www.tapkych.com').replace(/\/$/, '');
const REMIND_FROM = Number(process.env.TELEGRAM_REMIND_HOUR ?? 18);
const REMIND_UNTIL = Number(process.env.TELEGRAM_REMIND_UNTIL ?? 22);
const REMIND_EVERY_MS = Number(process.env.TELEGRAM_REMIND_EVERY_MS ?? 5 * 60_000);

/** Webhook'ту бөтөн адам чакырбашы үчүн жашыруун белги (токенден алынат) */
const SECRET = TOKEN ? crypto.createHash('sha256').update(`tapkych-webhook:${TOKEN}`).digest('hex').slice(0, 32) : '';

let botUsername: string | null = null;
/** Боттун аты (@сыз); null — бот өчүк */
export const telegramBot = () => botUsername;

type Button = { text: string; callback_data?: string; url?: string };
type Keyboard = Button[][];

interface TgResult<T> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
}

async function tg<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<TgResult<T>> {
  try {
    const r = await fetch(`${API}/bot${TOKEN}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params) });
    return (await r.json()) as TgResult<T>;
  } catch (e) {
    console.error(`Telegram ${method}:`, (e as Error).message);
    return { ok: false };
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const short = (s: string, n = 70) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Студент ботту бөгөттөсө (403) — байланышты үзөбүз, мындан ары жөнөтпөйбүз */
async function handleFail(chatId: string, r: TgResult<unknown>) {
  if (r.error_code === 403) await prisma.student.updateMany({ where: { telegramChatId: chatId }, data: { telegramChatId: null } });
}

async function send(chatId: string, text: string, keyboard?: Keyboard) {
  const r = await tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}) });
  if (!r.ok) await handleFail(chatId, r);
  return r;
}

async function edit(chatId: string, messageId: number, text: string, keyboard?: Keyboard) {
  const r = await tg('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
  // Билдирүүнү өзгөртүү мүмкүн болбосо (эски же өчүрүлгөн) — жаңысын жөнөтөбүз
  if (!r.ok && r.error_code !== 403 && !/not modified/i.test(r.description ?? '')) return send(chatId, text, keyboard);
  return r;
}

// ───────────────────────── Тексттер ─────────────────────────

const LETTER: Record<string, string> = { A: 'А', B: 'Б', C: 'В', D: 'Г' };
const TF: Record<string, string> = { A: 'Туура', B: 'Туура эмес' };
const siteButton: Button = { text: 'Кабинетти ачуу', url: `${SITE}/me` };
const dailyButton: Button = { text: 'Күндүн суроолору', callback_data: 'daily' };

const T = {
  intro:
    '<b>Тапкыч ордо</b> — интеллектуалдык оюн.\n\nБул бот студенттерге күн сайын 5 суроо жөнөтөт жана сериясын эскертип турат.\n\n' +
    `Туташтыруу үчүн <a href="${SITE}/me">студенттин кабинетине</a> мугалим берген код менен кирип, «Telegram'га туташтыруу» баскычын басыңыз.`,
  badCode: 'Бул шилтеме эскирген же жараксыз. Кабинеттен «Telegram\'га туташтыруу» баскычын кайра басыңыз.',
  welcome: (name: string) =>
    `Салам, <b>${esc(name)}</b>! Сиз Тапкыч ордого туташтыңыз.\n\nАр күнү 5 жаңы суроо. Катары менен аткарсаңыз — серияңыз өсөт. Аткара элек болсоңуз, кечинде эскертем.`,
  help: 'Буйруктар:\n/daily — күндүн суроолору\n/stats — менин жыйынтыгым\n/stop — боттон ажыратуу',
  stopped: 'Бот ажыратылды, эскертмелер мындан ары келбейт. Кайра туташтыруу үчүн кабинеттеги баскычты басыңыз.',
  dayChanged: 'Күн алмашты — бүгүнкү суроолор жаңыланды. /daily менен кайра баштаңыз.',
  noQuestions: 'Азырынча суроолор жок. Кийинчерээк кайра кириңиз.',
  question: (i: number, n: number, q: LibraryQuestion) =>
    `<b>Күндүн суроолору · ${i + 1}/${n}</b>${q.category ? `\n<i>${esc(q.category)}</i>` : ''}\n\n${esc(q.text)}` +
    (q.imageUrl ? `\n\n<a href="${SITE}${q.imageUrl.startsWith('/') ? '' : '/'}${q.imageUrl}">Сүрөттү ачуу</a>` : ''),
  orderHint: (picked: string[]) => `\n\nТуура тартипти тандаңыз${picked.length ? `: ${picked.join(' → ')} → …` : ' — биринчиси кайсы?'}`,
  result: (c: number, n: number) => `<b>Жыйынтык: ${c}/${n} туура</b>`,
  streak: (s: number, best: number) => `Серия: <b>${s}</b> күн${best > s ? ` (эң узун — ${best})` : ''}`,
  tomorrow: 'Эртең жаңы суроолор болот.',
  reminder: (name: string, streak: number) =>
    streak > 0
      ? `${esc(name)}, серияңыз <b>${streak}</b> күн — үзүлүп калбасын! Бүгүнкү 5 суроо сизди күтүп жатат.`
      : `${esc(name)}, бүгүнкү 5 суроо даяр. Бир-эки мүнөт — жана жаңы серия башталат!`,
  stats: (name: string, streak: number, best: number, days: number, correct: number, answered: number) =>
    `<b>${esc(name)}</b>\nСерия: ${streak} күн (эң узун — ${best})\nАткарылган күндөр: ${days}\nТуура жооптор: ${correct}/${answered}${answered ? ` (${Math.round((correct / answered) * 100)}%)` : ''}`,
};

function optionText(q: LibraryQuestion, letter: string) {
  return q.type === 'TF' ? TF[letter] : (q as unknown as Record<string, string>)[`option${letter}`] ?? letter;
}

function answerText(q: LibraryQuestion, choice: string | null) {
  if (!choice) return 'жооп жок';
  if (q.type === 'ORDER') return choice.split('').map((l) => optionText(q, l)).join(' → ');
  return q.type === 'TF' ? TF[choice] : `${LETTER[choice]}) ${optionText(q, choice)}`;
}

// ───────────────────────── Күндүн суроолору ─────────────────────────

/** Абал: q|YYYYMMDD|жооптор (чекит менен)|ORDER үчүн тандалгандар */
interface State {
  day: string;
  answers: string[];
  partial: string;
}
const encode = (s: State) => `q|${s.day.replace(/-/g, '')}|${s.answers.join('.')}|${s.partial}`;
function decode(data: string): State | null {
  const m = /^q\|(\d{8})\|([A-D.]*)\|([A-D]{0,3})$/.exec(data);
  if (!m) return null;
  return { day: `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6)}`, answers: m[2] ? m[2].split('.') : [], partial: m[3] };
}

async function studentByChat(chatId: string) {
  return prisma.student.findUnique({ where: { telegramChatId: chatId } });
}

async function showDone(chatId: string, studentId: number, details: Detail[], messageId?: number) {
  const qs = await prisma.libraryQuestion.findMany({ where: { id: { in: details.map((d) => d.id) } } });
  const lines = details.map((d, i) => {
    const q = qs.find((x) => x.id === d.id);
    if (!q) return `${i + 1}. —`;
    const ok = d.choice === d.correct;
    return `${i + 1}. ${ok ? '✓' : '✗'} ${esc(short(q.text))}${ok ? '' : `\n    Туура жооп: <b>${esc(answerText(q, d.correct))}</b>`}`;
  });
  const correct = details.filter((d) => d.choice === d.correct).length;
  const { streak, best } = await streakOf(studentId);
  const text = `${T.result(correct, details.length)}\n${T.streak(streak, best)}\n\n${lines.join('\n')}\n\n${T.tomorrow}`;
  const kb: Keyboard = [[siteButton]];
  return messageId ? edit(chatId, messageId, text, kb) : send(chatId, text, kb);
}

async function step(chatId: string, state: State, messageId?: number) {
  const student = await studentByChat(chatId);
  if (!student) return send(chatId, T.intro);
  const today = bishkekDay();
  const done = await prisma.practiceAttempt.findFirst({ where: { studentId: student.id, kind: 'DAILY', day: today } });
  if (done) return showDone(chatId, student.id, JSON.parse(done.details) as Detail[], messageId);
  if (state.day !== today) return messageId ? edit(chatId, messageId, T.dayChanged, [[dailyButton]]) : send(chatId, T.dayChanged);

  const qs = await dailyQuestions(today);
  if (!qs.length) return send(chatId, T.noQuestions);

  // ORDER: үч тандалса — төртүнчүсү өзүнөн-өзү аныкталат
  if (state.partial.length === 3) {
    const rest = 'ABCD'.split('').find((l) => !state.partial.includes(l))!;
    state = { ...state, answers: [...state.answers, state.partial + rest], partial: '' };
  }

  if (state.answers.length >= qs.length) {
    const g = grade(qs, new Map(qs.map((q, i) => [q.id, state.answers[i] ?? ''])));
    await prisma.practiceAttempt.create({ data: { studentId: student.id, kind: 'DAILY', day: today, correct: g.correct, total: g.total, details: JSON.stringify(g.details) } });
    return showDone(chatId, student.id, g.details, messageId);
  }

  const i = state.answers.length;
  const q = qs[i];
  const next = (choice: string): string => encode({ ...state, answers: [...state.answers, choice], partial: '' });
  let text = T.question(i, qs.length, q);
  let kb: Keyboard;
  if (q.type === 'TF') {
    kb = [[{ text: TF.A, callback_data: next('A') }, { text: TF.B, callback_data: next('B') }]];
  } else if (q.type === 'ORDER') {
    const picked = state.partial.split('').filter(Boolean);
    text += `\n\n${['A', 'B', 'C', 'D'].map((l) => `${LETTER[l]}) ${esc(optionText(q, l))}`).join('\n')}`;
    text += T.orderHint(picked.map((l) => LETTER[l]));
    kb = [
      ['A', 'B', 'C', 'D']
        .filter((l) => !state.partial.includes(l))
        .map((l) => ({ text: LETTER[l], callback_data: encode({ ...state, partial: state.partial + l }) })),
    ];
  } else {
    text += `\n\n${['A', 'B', 'C', 'D'].map((l) => `${LETTER[l]}) ${esc(optionText(q, l))}`).join('\n')}`;
    kb = [
      ['A', 'B'].map((l) => ({ text: LETTER[l], callback_data: next(l) })),
      ['C', 'D'].map((l) => ({ text: LETTER[l], callback_data: next(l) })),
    ];
  }
  return messageId ? edit(chatId, messageId, text, kb) : send(chatId, text, kb);
}

const startDaily = (chatId: string) => step(chatId, { day: bishkekDay(), answers: [], partial: '' });

// ───────────────────────── Буйруктар ─────────────────────────

async function link(chatId: string, code: string) {
  const student = code ? await prisma.student.findUnique({ where: { telegramLinkCode: code } }) : null;
  if (!student) return send(chatId, T.badCode);
  // Бир чат — бир студент: мурда башка студентке байланган болсо, ал байланыш үзүлөт
  await prisma.student.updateMany({ where: { telegramChatId: chatId, NOT: { id: student.id } }, data: { telegramChatId: null } });
  await prisma.student.update({ where: { id: student.id }, data: { telegramChatId: chatId, telegramLinkCode: null } });
  return send(chatId, T.welcome(student.name), [[dailyButton], [siteButton]]);
}

async function stats(chatId: string) {
  const student = await studentByChat(chatId);
  if (!student) return send(chatId, T.intro);
  const attempts = await prisma.practiceAttempt.findMany({ where: { studentId: student.id }, select: { kind: true, correct: true, total: true } });
  const { streak, best } = await streakOf(student.id);
  const sum = (k: 'correct' | 'total') => attempts.reduce((n, a) => n + a[k], 0);
  return send(chatId, T.stats(student.name, streak, best, attempts.filter((a) => a.kind === 'DAILY').length, sum('correct'), sum('total')), [[dailyButton], [siteButton]]);
}

interface Update {
  update_id: number;
  message?: { chat: { id: number | string }; text?: string };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number | string }; message_id: number } };
}

export async function handleUpdate(u: Update) {
  if (u.message?.text) {
    const chatId = String(u.message.chat.id);
    const [cmd, arg = ''] = u.message.text.trim().split(/\s+/);
    switch (cmd.replace(/@.*$/, '').toLowerCase()) {
      case '/start':
        if (arg) return link(chatId, arg);
        return (await studentByChat(chatId)) ? send(chatId, T.help, [[dailyButton], [siteButton]]) : send(chatId, T.intro);
      case '/daily':
        return startDaily(chatId);
      case '/stats':
        return stats(chatId);
      case '/stop':
        await prisma.student.updateMany({ where: { telegramChatId: chatId }, data: { telegramChatId: null } });
        return send(chatId, T.stopped);
      default:
        return (await studentByChat(chatId)) ? send(chatId, T.help, [[dailyButton]]) : send(chatId, T.intro);
    }
  }
  const cq = u.callback_query;
  if (cq?.message) {
    await tg('answerCallbackQuery', { callback_query_id: cq.id });
    const chatId = String(cq.message.chat.id);
    if (cq.data === 'daily') return startDaily(chatId);
    const state = cq.data ? decode(cq.data) : null;
    if (state) return step(chatId, state, cq.message.message_id);
  }
}

// ───────────────────────── Эскертмелер ─────────────────────────

let reminding = false;
export async function sendReminders(now = Date.now()) {
  const hour = new Date(now + 6 * 3600_000).getUTCHours();
  if (!botUsername || reminding || hour < REMIND_FROM || hour >= REMIND_UNTIL) return;
  reminding = true;
  try {
    const day = bishkekDay(now);
    const list = await prisma.student.findMany({ where: { telegramChatId: { not: null }, NOT: { telegramRemindedDay: day } } });
    for (const s of list) {
      await prisma.student.update({ where: { id: s.id }, data: { telegramRemindedDay: day } });
      if (await prisma.practiceAttempt.findFirst({ where: { studentId: s.id, kind: 'DAILY', day } })) continue;
      const { streak } = await streakOf(s.id);
      await send(s.telegramChatId!, T.reminder(s.name, streak), [[dailyButton]]);
      await new Promise((r) => setTimeout(r, 50)); // Telegram'дын чеги: секундасына ~30 билдирүү
    }
  } finally {
    reminding = false;
  }
}

// ───────────────────────── Иштетүү ─────────────────────────

export const telegramRouter = Router();
telegramRouter.post('/webhook', async (req, res) => {
  if (!SECRET || req.get('x-telegram-bot-api-secret-token') !== SECRET) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }
  await handleUpdate(req.body as Update).catch((e) => console.error('Telegram update:', e));
  res.json({ ok: true });
});

async function poll() {
  let offset = 0;
  for (;;) {
    const r = await tg<Update[]>('getUpdates', { offset, timeout: 25, allowed_updates: ['message', 'callback_query'] });
    if (!r.ok) {
      await new Promise((res) => setTimeout(res, 5000));
      continue;
    }
    for (const u of r.result ?? []) {
      offset = u.update_id + 1;
      await handleUpdate(u).catch((e) => console.error('Telegram update:', e));
    }
  }
}

export async function startTelegram() {
  if (!TOKEN) return;
  const me = await tg<{ username: string }>('getMe');
  if (!me.ok || !me.result) {
    console.warn('  ! Telegram-бот: TELEGRAM_BOT_TOKEN иштебей жатат — бот өчүк');
    return;
  }
  botUsername = me.result.username;
  await tg('setMyCommands', {
    commands: [
      { command: 'daily', description: 'Күндүн суроолору' },
      { command: 'stats', description: 'Менин жыйынтыгым' },
      { command: 'stop', description: 'Боттон ажыратуу' },
    ],
  });
  const https = (u?: string) => (u && u.startsWith('https://') ? u.replace(/\/$/, '') : '');
  const base = https(process.env.TELEGRAM_WEBHOOK_URL) || https(process.env.RENDER_EXTERNAL_URL) || https(config.publicUrl);
  if (base) {
    await tg('setWebhook', { url: `${base}/api/telegram/webhook`, secret_token: SECRET, allowed_updates: ['message', 'callback_query'] });
  } else {
    await tg('deleteWebhook');
    void poll();
  }
  setInterval(() => void sendReminders().catch((e) => console.error('Telegram эскертме:', e)), REMIND_EVERY_MS).unref();
  console.log(`  ✓ Telegram-бот: @${botUsername}${base ? ' (webhook)' : ' (polling)'}`);
}
