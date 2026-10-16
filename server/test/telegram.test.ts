/** Telegram-бот: туташтыруу, күндүн суроолору баскычтар менен, эскертмелер, бөгөттөө (жасалма Telegram API менен) */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { adminLogin, api, sleep, startServer, type TestServer } from './helpers.js';

interface Call {
  method: string;
  body: any;
}

let srv: TestServer;
let base: string;
let admin: string;
let fake: http.Server;
const calls: Call[] = [];
let messageId = 100;

/** Жасалма Telegram API: бардык чакырууларды жазып алат; chat_id '403' — бөгөттөлгөн колдонуучу */
function startFake(): Promise<string> {
  fake = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (d) => (raw += d));
    req.on('end', () => {
      const method = (req.url ?? '').split('/').pop()!;
      const body = raw ? JSON.parse(raw) : {};
      calls.push({ method, body });
      let out: unknown = { ok: true, result: true };
      if (method === 'getMe') out = { ok: true, result: { username: 'tapkych_test_bot' } };
      if (method === 'sendMessage')
        out = String(body.chat_id) === '403' ? { ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' } : { ok: true, result: { message_id: ++messageId } };
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(out));
    });
  });
  return new Promise((r) => fake.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${(fake.address() as AddressInfo).port}`)));
}

async function waitFor(pred: (c: Call) => boolean, ms = 5000): Promise<Call> {
  const deadline = Date.now() + ms;
  for (;;) {
    const c = calls.find(pred);
    if (c) return c;
    if (Date.now() > deadline) throw new Error(`Күтүлгөн Telegram чакыруусу келген жок. Акыркылары:\n${JSON.stringify(calls.slice(-5), null, 1)}`);
    await sleep(50);
  }
}

let secret = '';
let updateId = 1;
const hook = (update: object, token = secret) =>
  fetch(`${base}/api/telegram/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': token },
    body: JSON.stringify({ update_id: updateId++, ...update }),
  });
const say = (chat: string, text: string) => hook({ message: { chat: { id: chat }, text } });
const press = (chat: string, data: string, message_id: number) => hook({ callback_query: { id: `cq${updateId}`, data, message: { chat: { id: chat }, message_id } } });

/** Бул чатка акыркы жөнөтүлгөн же өзгөртүлгөн билдирүү */
const lastTo = (chat: string) => [...calls].reverse().find((c) => ['sendMessage', 'editMessageText'].includes(c.method) && String(c.body.chat_id) === chat);

before(async () => {
  const fakeUrl = await startFake();
  srv = await startServer('telegram', {
    TELEGRAM_BOT_TOKEN: '123:TEST',
    TELEGRAM_API_URL: fakeUrl,
    TELEGRAM_WEBHOOK_URL: 'https://bot.example',
    TELEGRAM_REMIND_HOUR: '0',
    TELEGRAM_REMIND_UNTIL: '24',
    TELEGRAM_REMIND_EVERY_MS: '300',
    SITE_URL: 'https://site.example',
  });
  base = srv.url;
  admin = await adminLogin(base);
  const hookCall = await waitFor((c) => c.method === 'setWebhook');
  assert.equal(hookCall.body.url, 'https://bot.example/api/telegram/webhook');
  secret = hookCall.body.secret_token;

  // 4 суроо: үч TF (экөөнүн туурасы «Туура», бирөөнүкү «Туура эмес») + бир ORDER (туура тартип ABCD)
  for (const [text, correct] of [
    ['ТГ суроо 1', 'A'],
    ['ТГ суроо 2', 'A'],
    ['ТГ суроо 3', 'B'],
  ]) {
    const r = await api(base, 'POST', '/api/library', { token: admin, body: { type: 'TF', category: 'Бот', text, correct } });
    assert.equal(r.status, 201);
  }
  const order = await api(base, 'POST', '/api/library', {
    token: admin,
    body: { type: 'ORDER', category: 'Бот', text: 'ТГ тартип', optionA: 'Бир', optionB: 'Эки', optionC: 'Үч', optionD: 'Төрт', correct: 'ABCD' },
  });
  assert.equal(order.status, 201, JSON.stringify(order.body));
  await api(base, 'POST', '/api/students', { token: admin, body: { lines: 'Айпери Ботова; Б-1\nБекзат Ботов; Б-1\nБөгөт Коюучу; Б-1' } });
  await api(base, 'POST', '/api/students/codes', { token: admin, body: {} });
});
after(async () => {
  await srv?.stop();
  fake?.close();
});

async function studentToken(name: string) {
  const s = (await api(base, 'GET', '/api/students', { token: admin })).body.students.find((x: any) => x.name === name);
  return (await api(base, 'POST', '/api/me/login', { body: { code: s.accessCode } })).body.token as string;
}

async function linkCode(token: string) {
  const r = await api(base, 'POST', '/api/me/telegram/link', { token });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.url, /^https:\/\/t\.me\/tapkych_test_bot\?start=[\w-]{16}$/);
  return r.body.url.split('=')[1] as string;
}

describe('Telegram-бот', () => {
  it('webhook жашыруун белгисиз кабыл алынбайт', async () => {
    assert.equal((await hook({ message: { chat: { id: 1 }, text: '/start' } }, 'wrong')).status, 401);
  });

  it('кабинеттен туташтыруу: бир жолку код, саламдашуу, эскертме', async () => {
    const token = await studentToken('Айпери Ботова');
    const me = (await api(base, 'GET', '/api/me', { token })).body;
    assert.deepEqual(me.telegram, { bot: 'tapkych_test_bot', linked: false });

    const code = await linkCode(token);
    assert.equal((await say('1001', `/start ${code}`)).status, 200);
    const welcome = await waitFor((c) => c.method === 'sendMessage' && c.body.chat_id === '1001' && /Айпери Ботова/.test(c.body.text));
    assert.equal(welcome.body.reply_markup.inline_keyboard[0][0].callback_data, 'daily');
    assert.equal((await api(base, 'GET', '/api/me', { token })).body.telegram.linked, true);

    // Код бир жолу гана иштейт
    await say('5555', `/start ${code}`);
    await waitFor((c) => c.method === 'sendMessage' && c.body.chat_id === '5555' && /эскирген/.test(c.body.text));

    // Бүгүнкү суроолор аткарыла элек — эскертме келет (бир гана жолу)
    await waitFor((c) => c.method === 'sendMessage' && c.body.chat_id === '1001' && /5 суроо/.test(c.body.text));
    await sleep(800);
    assert.equal(calls.filter((c) => c.method === 'sendMessage' && c.body.chat_id === '1001' && /5 суроо/.test(c.body.text)).length, 1);
  });

  it('күндүн суроолору баскычтар менен: ORDER тартиби, жыйынтык сайтка да сакталат', async () => {
    await say('1001', '/daily');
    let msg = await waitFor((c) => c.method === 'sendMessage' && c.body.chat_id === '1001' && /Күндүн суроолору · 1\/4/.test(c.body.text));
    const id = msg.body.message_id ?? messageId;
    // Ар дайым биринчи баскычты басабыз: TF → «Туура» (A), ORDER → калгандардын биринчиси (A, B, C → D)
    for (let i = 0; i < 12; i++) {
      msg = lastTo('1001')!;
      if (/Жыйынтык/.test(msg.body.text)) break;
      const before = calls.length;
      await press('1001', msg.body.reply_markup.inline_keyboard[0][0].callback_data, id);
      await waitFor((c) => calls.indexOf(c) >= before && c.method === 'editMessageText');
    }
    msg = lastTo('1001')!;
    assert.match(msg.body.text, /Жыйынтык: 3\/4 туура/);
    assert.match(msg.body.text, /Серия: <b>1<\/b> күн/);
    assert.match(msg.body.text, /✗ ТГ суроо 3\n {4}Туура жооп: <b>Туура эмес<\/b>/);
    assert.ok(calls.some((c) => c.method === 'answerCallbackQuery'));

    const token = await studentToken('Айпери Ботова');
    const daily = (await api(base, 'GET', '/api/me/daily', { token })).body;
    assert.equal(daily.done, true);
    assert.equal(daily.result.correct, 3);

    // Эски баскычты кайра басса — жаңы жазуу түзүлбөйт, жыйынтык гана көрсөтүлөт
    await press('1001', `q|${daily.day.replace(/-/g, '')}|A.A.A.ABCD|`, id);
    await sleep(300);
    assert.equal((await api(base, 'GET', '/api/me', { token })).body.totals.dailyDays, 1);

    await say('1001', '/stats');
    await waitFor((c) => c.method === 'sendMessage' && c.body.chat_id === '1001' && /Аткарылган күндөр: 1/.test(c.body.text));
  });

  it('суроолорду аткарып койгон студентке эскертме жөнөтүлбөйт', async () => {
    const token = await studentToken('Бекзат Ботов');
    const qs = (await api(base, 'GET', '/api/me/daily', { token })).body.questions;
    await api(base, 'POST', '/api/me/daily', { token, body: { answers: qs.map((q: any) => ({ id: q.id, choice: 'A' })) } });
    await say('2002', `/start ${await linkCode(token)}`);
    await waitFor((c) => c.method === 'sendMessage' && c.body.chat_id === '2002' && /Бекзат Ботов/.test(c.body.text));
    await sleep(1000);
    assert.equal(calls.filter((c) => c.method === 'sendMessage' && c.body.chat_id === '2002').length, 1);
  });

  it('ботту бөгөттөгөн студенттин байланышы үзүлөт; /stop жана кабинеттен ажыратуу', async () => {
    const blocked = await studentToken('Бөгөт Коюучу');
    await say('403', `/start ${await linkCode(blocked)}`);
    await sleep(300);
    assert.equal((await api(base, 'GET', '/api/me', { token: blocked })).body.telegram.linked, false);

    const token = await studentToken('Айпери Ботова');
    await say('1001', '/stop');
    await waitFor((c) => c.method === 'sendMessage' && c.body.chat_id === '1001' && /ажыратылды/.test(c.body.text));
    assert.equal((await api(base, 'GET', '/api/me', { token })).body.telegram.linked, false);

    const b = await studentToken('Бекзат Ботов');
    assert.equal((await api(base, 'DELETE', '/api/me/telegram', { token: b })).status, 200);
    assert.equal((await api(base, 'GET', '/api/me', { token: b })).body.telegram.linked, false);
  });
});
