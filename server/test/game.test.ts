/**
 * Оюндун толук агымы Socket.IO аркылуу: лобби → 1-тур → 2-тур → финал → бүттү.
 * Негизги эреже да текшерилет: туура жооп REVEAL фазасына чейин оюнчуга, экранга жана көрүүчүгө жетпейт.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Client, adminLogin, api, choiceQuestion, sleep, startServer, type TestServer } from './helpers.js';

let srv: TestServer;
let base: string;
let token: string;
const clients: Client[] = [];

before(async () => {
  srv = await startServer('game');
  base = srv.url;
  token = await adminLogin(base);
});
after(async () => {
  for (const c of clients) c.close();
  await srv?.stop();
});

function connect(auth: Record<string, unknown>): Client {
  const c = new Client(base, auth);
  clients.push(c);
  return c;
}

async function joinPlayer(code: string, pin: string): Promise<Client> {
  const r = await api(base, 'POST', '/api/join', { body: { code, pin } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const c = connect({ role: 'player', token: r.body.token });
  await c.connected();
  return c;
}

/** Алып баруучунун аракети: ийгиликтүү болушу керек */
async function act(admin: Client, action: Record<string, unknown>) {
  const res = await admin.emit('admin:action', action);
  assert.equal(res.ok, true, `${action.type}: ${JSON.stringify(res)}`);
}

const SETTINGS = { round1Count: 2, round2Count: 2, finalQuestionCount: 1, advanceToRound2: 2, advanceToFinal: 2, timerSeconds: 5, pointsPerCorrect: 10, speedBonus: 0, fiftyFifty: true };

describe('оюндун толук агымы', () => {
  let gameId: number;
  let code: string;
  let admin: Client;
  let screen: Client;
  let audience: Client;
  const p: Client[] = [];
  const ids: number[] = [];

  before(async () => {
    // Банк: 1-тур — 2, 2-тур — 2, финал — 1 суроо
    const bank: [Parameters<typeof choiceQuestion>[0], string, 'A' | 'B' | 'C' | 'D'][] = [
      ['ROUND1', '1-тур, 1-суроо', 'A'],
      ['ROUND1', '1-тур, 2-суроо', 'B'],
      ['ROUND2', '2-тур, 1-суроо', 'C'],
      ['ROUND2', '2-тур, 2-суроо', 'D'],
      ['FINAL', 'Финал суроосу', 'A'],
    ];
    for (const [round, text, correct] of bank) {
      const r = await api(base, 'POST', '/api/questions', { token, body: choiceQuestion(round, text, correct) });
      assert.equal(r.status, 201, JSON.stringify(r.body));
    }

    const g = await api(base, 'POST', '/api/games', { token, body: { title: 'Тест оюну', players: ['Азамат', 'Бермет', 'Жылдыз', 'Темир'], settings: SETTINGS } });
    assert.equal(g.status, 201, JSON.stringify(g.body));
    gameId = g.body.game.id;
    code = g.body.game.code;
    for (const pl of g.body.game.players) ids.push(pl.id);

    admin = connect({ role: 'admin', token, gameId });
    screen = connect({ role: 'screen', code });
    audience = connect({ role: 'audience', code, voterId: 'voter-12345678' });
    await Promise.all([admin.connected(), screen.connected(), audience.connected()]);
    for (const pl of g.body.game.players) p.push(await joinPlayer(code, pl.pin));
  });

  it('туташуу: туура эмес токен менен кирүүгө болбойт', async () => {
    const bad = connect({ role: 'admin', token: 'nope', gameId });
    await assert.rejects(bad.connected());
    const badPlayer = connect({ role: 'player', token: 'xxxxxxxxxxxxxxxx' });
    await assert.rejects(badPlayer.connected());
  });

  it('лобби: оюнчулар кошулду, экранда көрүнөт', async () => {
    const s = await admin.waitFor((s) => s.players.every((x: any) => x.joined));
    assert.equal(s.game.status, 'LOBBY');
    const sc = await screen.waitFor((s) => s.players.length === 4);
    assert.equal(sc.players.length, 4);
  });

  it('оюн башталбаганда жооп берүүгө болбойт', async () => {
    const r = await p[0].emit('player:answer', { choice: 'A' });
    assert.equal(r.ok, false);
  });

  it('1-тур: суроо көрсөтүлгөнгө чейин тексти жашырылган', async () => {
    await act(admin, { type: 'startGame' });
    await admin.waitFor((s) => s.game.status === 'ROUND1' && s.game.phase === 'IDLE');
    await act(admin, { type: 'nextQuestion' });
    const ps = await p[0].waitFor((s) => s.game.phase === 'READY');
    assert.equal(ps.question.text, null);
    assert.equal(ps.question.options, null);
    assert.equal(ps.question.correct, null);
  });

  it('1-тур, 1-суроо: туура жооп REVEAL чейин эч кимге жөнөтүлбөйт', async () => {
    await act(admin, { type: 'showQuestion' });
    const ps = await p[0].waitFor((s) => s.game.phase === 'QUESTION');
    assert.equal(ps.question.text, '1-тур, 1-суроо');
    assert.equal(ps.question.correct, null);
    assert.equal(ps.question.myCorrect, null);
    const sc = await screen.waitFor((s) => s.game.phase === 'QUESTION');
    assert.equal(sc.question.correct, null);
    assert.equal(sc.question.stats, null);
    const au = await audience.waitFor((s) => s.game.phase === 'QUESTION');
    assert.equal(au.question.correct, null);
    // Алып баруучу гана көрөт
    const ad = await admin.waitFor((s) => s.game.phase === 'QUESTION');
    assert.equal(ad.question.correct, 'A');
  });

  it('жооптор: туура/ката формат, кайталап жооп берүүгө болбойт', async () => {
    assert.deepEqual(await p[0].emit('player:answer', { choice: 'a' }), { ok: true });
    assert.equal((await p[1].emit('player:answer', { choice: 'B' })).ok, true);
    assert.equal((await p[2].emit('player:answer', { choice: 'A' })).ok, true);
    // p[3] жооп бербейт
    assert.equal((await p[0].emit('player:answer', { choice: 'B' })).error, 'ALREADY_ANSWERED');
    assert.equal((await p[3].emit('player:answer', { choice: 'E' })).error, 'BAD_REQUEST');

    assert.equal((await audience.emit('audience:vote', { choice: 'A' })).ok, true);
    assert.equal((await audience.emit('audience:vote', { choice: 'B' })).error, 'ALREADY_ANSWERED');

    const ad = await admin.waitFor((s) => Object.keys(s.answers).length === 3);
    assert.equal(ad.answers[ids[0]].isCorrect, true);
    assert.equal(ad.answers[ids[1]].isCorrect, false);
    // Экран ким жооп бергенин көрөт, бирок туурабы — жок
    const sc = await screen.waitFor((s) => s.players.filter((x: any) => x.answered).length === 3);
    assert.ok(sc.players.every((x: any) => x.correct === null));
  });

  it('REVEAL: туура жооп жана упайлар ачылат', async () => {
    await act(admin, { type: 'revealAnswer' });
    const ps = await p[0].waitFor((s) => s.game.phase === 'REVEAL');
    assert.equal(ps.question.correct, 'A');
    assert.equal(ps.question.myCorrect, true);
    assert.equal(ps.question.myPoints, 10);
    const ps1 = await p[1].waitFor((s) => s.game.phase === 'REVEAL');
    assert.equal(ps1.question.myCorrect, false);
    assert.equal(ps1.question.myPoints, 0);
    const sc = await screen.waitFor((s) => s.game.phase === 'REVEAL');
    assert.equal(sc.question.correct, 'A');
    assert.equal(sc.question.audience.counts.A, 1);
    // Жооп ачылгандан кийин жооп берүүгө болбойт
    assert.equal((await p[3].emit('player:answer', { choice: 'A' })).error, 'TIME_UP');
  });

  it('1-тур, 2-суроо жана турдун аягы: сунушталган оюнчулар', async () => {
    await act(admin, { type: 'nextQuestion' });
    await act(admin, { type: 'showQuestion' });
    await p[0].waitFor((s) => s.game.phase === 'QUESTION' && s.game.index === 1);
    await p[0].emit('player:answer', { choice: 'B' });
    await p[1].emit('player:answer', { choice: 'B' });
    await p[2].emit('player:answer', { choice: 'C' });
    await act(admin, { type: 'revealAnswer' });
    // Акыркы суроо эмес болсо endRound болбойт — бул акыркысы, ошондуктан иштейт
    await act(admin, { type: 'endRound' });
    const ad = await admin.waitFor((s) => s.game.phase === 'ROUND_END' && s.roundEnd);
    // Азамат: 20, Бермет: 10, Жылдыз: 10, Темир: 0
    const scores = Object.fromEntries(ad.roundEnd.ranking.map((r: any) => [r.playerId, r.score]));
    assert.deepEqual([scores[ids[0]], scores[ids[1]], scores[ids[2]], scores[ids[3]]], [20, 10, 10, 0]);
    assert.equal(ad.roundEnd.ranking[0].playerId, ids[0]);
    assert.equal(ad.roundEnd.ranking[3].playerId, ids[3]);
    assert.equal(ad.roundEnd.suggested.length, 2);
    assert.equal(ad.roundEnd.suggested[0], ids[0]);
  });

  it('2-турга өтүү: чыгарылган оюнчу жооп бере албайт', async () => {
    await act(admin, { type: 'confirmAdvance', playerIds: [ids[0], ids[1]] });
    await admin.waitFor((s) => s.game.status === 'ROUND2');
    const out = await p[2].waitFor((s) => s.game.status === 'ROUND2');
    assert.equal(out.me.status, 'ELIMINATED');
    assert.equal(out.inRound, false);

    await act(admin, { type: 'nextQuestion' });
    await act(admin, { type: 'showQuestion' });
    await p[0].waitFor((s) => s.game.phase === 'QUESTION');
    assert.equal((await p[2].emit('player:answer', { choice: 'C' })).error, 'NOT_IN_ROUND');
    assert.equal((await p[0].emit('player:answer', { choice: 'C' })).ok, true);
    assert.equal((await p[1].emit('player:answer', { choice: 'A' })).ok, true);
    await act(admin, { type: 'revealAnswer' });
  });

  it('тыныгуу: убакыт токтойт, жооп кабыл алынбайт', async () => {
    await act(admin, { type: 'nextQuestion' });
    await act(admin, { type: 'showQuestion' });
    await act(admin, { type: 'togglePause' });
    const ad = await admin.waitFor((s) => s.game.paused);
    assert.equal(ad.game.endsAt, null);
    assert.ok(ad.game.pausedRemainingMs > 0);
    assert.equal((await p[1].emit('player:answer', { choice: 'D' })).error, 'GAME_PAUSED');
    // Тыныгуу учурунда кийинки суроого өтүүгө болбойт
    assert.equal((await admin.emit('admin:action', { type: 'nextQuestion' })).ok, false);

    await act(admin, { type: 'togglePause' });
    const resumed = await admin.waitFor((s) => !s.game.paused);
    assert.ok(resumed.game.endsAt > Date.now() - 1000);
    assert.equal((await p[1].emit('player:answer', { choice: 'D' })).ok, true);
    await act(admin, { type: 'revealAnswer' });
    await act(admin, { type: 'endRound' });
    await act(admin, { type: 'confirmAdvance', playerIds: [ids[0], ids[1]] });
    await admin.waitFor((s) => s.game.status === 'FINAL');
  });

  it('финал: 50/50 эки ката вариантты жашырат, бир жолу гана', async () => {
    await act(admin, { type: 'nextQuestion' });
    await act(admin, { type: 'showQuestion' });
    await p[1].waitFor((s) => s.game.phase === 'QUESTION');
    assert.equal((await p[1].emit('player:fifty', {})).ok, true);
    const ps = await p[1].waitFor((s) => s.question.hidden.length === 2);
    assert.ok(!ps.question.hidden.includes('A'), 'туура жооп жашырылбашы керек');
    assert.equal(ps.fiftyAvailable, false);
    assert.equal(ps.question.correct, null);
    // Башка оюнчуга жашырылган варианттар жөнөтүлбөйт
    assert.deepEqual(p[0].state.question.hidden, []);
    assert.equal((await p[1].emit('player:fifty', {})).error, 'LIFELINE_USED');

    await p[0].emit('player:answer', { choice: 'A' });
    await p[1].emit('player:answer', { choice: 'A' });
    await act(admin, { type: 'revealAnswer' });
    await act(admin, { type: 'endRound' });
    await act(admin, { type: 'finishGame' });
  });

  it('оюн бүттү: жыйынтыктар туура', async () => {
    const ad = await admin.waitFor((s) => s.game.status === 'FINISHED');
    assert.equal(ad.standings.length, 4);
    // Финалисттер жогору, андан кийин 2-тур, андан кийин 1-тур
    assert.deepEqual(
      ad.standings.map((s: any) => s.reached),
      ['FINAL', 'FINAL', 'ROUND1', 'ROUND1'],
    );
    assert.equal(ad.askedQuestions.length, 5);

    const ps = await p[0].waitFor((s) => s.game.status === 'FINISHED' && s.final);
    assert.ok(ps.final.place === 1 || ps.final.place === 2);
    // Бөлүшүү карточкасы үчүн: жеңүүчүлөр, оюнчулардын саны, бүткөн убакыт
    assert.equal(ps.podium.length, 3);
    assert.deepEqual(
      ps.podium.map((x: any) => x.name),
      ad.standings.slice(0, 3).map((x: any) => x.name),
    );
    assert.equal(ps.players, 4);
    assert.ok(ps.game.finishedAt > Date.now() - 60_000);
    const sc = await screen.waitFor((s) => s.game.status === 'FINISHED');
    assert.equal(sc.finalRanking.length, 2);

    assert.equal((await admin.emit('admin:action', { type: 'startGame' })).error, 'INVALID_ACTION');
  });

  it('суралган суроолор архивге өттү, тарыхта жана replay’де бар', async () => {
    const qs = (await api(base, 'GET', '/api/questions', { token })).body.questions;
    assert.equal(qs.length, 5);
    assert.ok(qs.every((q: any) => q.archived && q.usedCount === 1));
    // Статистика: 1-суроого 3 жооп, 2си туура (Азамат жана Жылдыз)
    assert.deepEqual(qs.find((q: any) => q.text === '1-тур, 1-суроо').stats, { answered: 3, correct: 2 });
    assert.deepEqual(qs.find((q: any) => q.text === 'Финал суроосу').stats, { answered: 2, correct: 2 });

    const hist = (await api(base, 'GET', '/api/games/history', { token })).body.games;
    const h = hist.find((x: any) => x.id === gameId);
    assert.ok(h);
    assert.equal(h.questions, 5);
    assert.equal(h.top.length, 3);

    const replay = (await api(base, 'GET', `/api/games/${gameId}/replay`, { token })).body;
    assert.equal(replay.steps.length, 5);
    assert.equal(replay.steps[0].correct, 'A');
  });
});

describe('башка учурлар', () => {
  let admin: Client;
  let gameId: number;
  let code: string;
  let players: { id: number; pin: string }[];

  before(async () => {
    const g = await api(base, 'POST', '/api/games', { token, body: { players: ['Айбек', 'Гүлнара', 'Данияр'], settings: { ...SETTINGS, round1Count: 1, round2Count: 1 } } });
    gameId = g.body.game.id;
    code = g.body.game.code;
    players = g.body.game.players;
    admin = connect({ role: 'admin', token, gameId });
    await admin.connected();
  });

  it('банкта суроо жетишсиз болсо оюн башталбайт — NOT_ENOUGH_QUESTIONS', async () => {
    // Мурунку оюн бардык суроолорду архивге жылдырды
    const r = await admin.emit('admin:action', { type: 'startGame' });
    assert.equal(r.error, 'NOT_ENOUGH_QUESTIONS');
  });

  it('архивден кайтарылгандан кийин оюн башталат', async () => {
    const r = await api(base, 'POST', '/api/questions/restore', { token, body: {} });
    assert.equal(r.body.restored, 5);
    await act(admin, { type: 'startGame' });
  });

  it('ошол эле PIN менен экинчи түзмөктөн кирсе, биринчиси ажыратылат', async () => {
    const first = await joinPlayer(code, players[0].pin);
    const second = await joinPlayer(code, players[0].pin);
    await sleep(300);
    assert.ok(first.events.includes('session:replaced'));
    assert.ok(second.socket.connected);
  });

  it('оюнчуну чыгаруу: түзмөгү ажыратылат, кайра кире албайт', async () => {
    const c = await joinPlayer(code, players[1].pin);
    await act(admin, { type: 'kickPlayer', playerId: players[1].id });
    await sleep(300);
    assert.ok(c.events.includes('player:kicked'));
    const r = await api(base, 'POST', '/api/join', { body: { code, pin: players[1].pin } });
    assert.equal(r.body.error, 'PLAYER_KICKED');
  });

  it('упайды кол менен оңдоо: чектен тышкары маани кабыл алынбайт', async () => {
    assert.equal((await admin.emit('admin:action', { type: 'adjustScore', playerId: players[0].id, delta: 0 })).error, 'BAD_REQUEST');
    assert.equal((await admin.emit('admin:action', { type: 'adjustScore', playerId: players[0].id, delta: 500 })).error, 'BAD_REQUEST');
    await act(admin, { type: 'adjustScore', playerId: players[0].id, delta: 5 });
  });

  it('таймер бүткөндөн кийин жооп кабыл алынбайт — TIME_UP', async () => {
    const pl = await joinPlayer(code, players[2].pin);
    await act(admin, { type: 'nextQuestion' });
    await act(admin, { type: 'showQuestion' });
    await pl.waitFor((s) => s.game.phase === 'QUESTION');
    await sleep(SETTINGS.timerSeconds * 1000 + 700);
    assert.equal((await pl.emit('player:answer', { choice: 'A' })).error, 'TIME_UP');
  });

  it('суроону кайра баштоо: READY фазасына кайтат', async () => {
    await act(admin, { type: 'restartQuestion' });
    const s = await admin.waitFor((s) => s.game.phase === 'READY');
    assert.equal(s.question.startedAt, null);
  });

  it('оюнду өчүрүү: туташкандарга game:deleted', async () => {
    const watcher = connect({ role: 'screen', code });
    await watcher.connected();
    const r = await api(base, 'DELETE', `/api/games/${gameId}`, { token });
    assert.equal(r.status, 200);
    await sleep(300);
    assert.ok(watcher.events.includes('game:deleted'));
  });
});
