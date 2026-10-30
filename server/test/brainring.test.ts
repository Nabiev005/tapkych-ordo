/**
 * Брейн-ринг: команда командага каршы, бир тур, ар бир суроо «биринчи баскан»,
 * ката айткан команда ошол суроодо кайра баса албайт.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Client, adminLogin, api, choiceQuestion, startServer, type TestServer } from './helpers.js';

let srv: TestServer;
let base: string;
let token: string;
const clients: Client[] = [];

before(async () => {
  srv = await startServer('brainring');
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

async function act(admin: Client, action: Record<string, unknown>) {
  const res = await admin.emit('admin:action', action);
  assert.equal(res.ok, true, `${action.type}: ${JSON.stringify(res)}`);
}

describe('Брейн-ринг', () => {
  let gameId: number;
  let admin: Client;
  let screen: Client;
  const p: Client[] = [];
  const ids: number[] = [];

  before(async () => {
    // Брейн-рингге 1-турдун суроолору гана керек (2-тур жана финал банкта жок)
    for (const text of ['Б1', 'Б2']) await api(base, 'POST', '/api/questions', { token, body: choiceQuestion('ROUND1', text, 'A') });
    const g = await api(base, 'POST', '/api/games', {
      token,
      body: { players: ['Азамат', 'Бермет', 'Жылдыз', 'Темир'], settings: { mode: 'BRAIN_RING', round1Count: 2, timerSeconds: 30, pointsPerCorrect: 3, introEnabled: false } },
    });
    assert.equal(g.status, 201, JSON.stringify(g.body));
    assert.equal(g.body.game.mode, 'BRAIN_RING');
    assert.equal(g.body.game.teamMode, true);
    gameId = g.body.game.id;
    admin = connect({ role: 'admin', token, gameId });
    screen = connect({ role: 'screen', code: g.body.game.code });
    await Promise.all([admin.connected(), screen.connected()]);
    for (const pl of g.body.game.players) {
      ids.push(pl.id);
      const j = await api(base, 'POST', '/api/join', { body: { code: g.body.game.code, pin: pl.pin } });
      const c = connect({ role: 'player', token: j.body.token });
      await c.connected();
      p.push(c);
    }
  });

  it('команда жок болсо оюн башталбайт; лоббиде командаларды бөлүүгө болот', async () => {
    assert.equal((await admin.emit('admin:action', { type: 'startGame' })).error, 'NOT_ENOUGH_TEAMS');
    // Азамат + Бермет — «Ак шумкар», Жылдыз + Темир — «Тулпар»
    for (const [i, team] of [[0, 'Ак шумкар'], [1, 'Ак шумкар'], [2, 'Тулпар'], [3, 'Тулпар']] as const) {
      const r = await api(base, 'PATCH', `/api/games/${gameId}/players/${ids[i]}`, { token, body: { team } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
    }
    await act(admin, { type: 'startGame' });
    const sc = await screen.waitFor((s) => s.game.status === 'ROUND1');
    assert.equal(sc.game.mode, 'BRAIN_RING');
    assert.equal(sc.game.total, 2);
    // Командалардын эсеби экранда оюн башталгандан эле көрүнөт
    assert.deepEqual(sc.teams.map((t: any) => t.team).sort(), ['Ак шумкар', 'Тулпар']);
  });

  it('ар бир суроо — «биринчи баскан»; ката айткан команда бөгөттөлөт', async () => {
    await act(admin, { type: 'nextQuestion' });
    await act(admin, { type: 'showQuestion' });
    const sc0 = await screen.waitFor((s) => s.game.phase === 'QUESTION');
    assert.equal(sc0.game.buzzer, true);
    assert.equal((await p[0].emit('player:answer', { choice: 'A' })).error, 'INVALID_ACTION');

    assert.equal((await p[0].emit('player:buzz', {})).ok, true); // Ак шумкар басты
    // Командалашы (Бермет) кайра баса албайт
    assert.equal((await p[1].emit('player:buzz', {})).error, 'ALREADY_ANSWERED');
    const me1 = await p[1].waitFor((s) => s.teamPressed === true);
    assert.equal(me1.myPress, null);

    // Азамат ката айтты — кезек Тулпарга
    await act(admin, { type: 'judgeBuzz', correct: false });
    assert.equal((await p[1].emit('player:buzz', {})).error, 'ALREADY_ANSWERED');
    assert.equal((await p[3].emit('player:buzz', {})).ok, true); // Тулпар
    const sc = await screen.waitFor((s) => s.pressOrder?.length === 2);
    assert.deepEqual(sc.pressOrder.map((x: any) => [x.name, x.team, x.status]), [
      ['Азамат', 'Ак шумкар', 'wrong'],
      ['Темир', 'Тулпар', 'pending'],
    ]);
    await act(admin, { type: 'judgeBuzz', correct: true });
    const rv = await screen.waitFor((s) => s.game.phase === 'REVEAL');
    assert.equal(rv.teams.find((t: any) => t.team === 'Тулпар').total, 3);
    assert.equal(rv.teams.find((t: any) => t.team === 'Ак шумкар').total, 0);
  });

  it('бир тур: аягында кийинки турга өтүүгө болбойт, оюн ошол замат бүтөт', async () => {
    await act(admin, { type: 'nextQuestion' });
    await act(admin, { type: 'showQuestion' });
    await act(admin, { type: 'revealAnswer' });
    await act(admin, { type: 'endRound' });
    await admin.waitFor((s) => s.game.phase === 'ROUND_END');
    assert.equal((await admin.emit('admin:action', { type: 'confirmAdvance', playerIds: ids })).error, 'INVALID_ACTION');
    assert.equal((await admin.emit('admin:action', { type: 'setRoundCount', round: 'ROUND2', count: 3 })).error, 'INVALID_ACTION');
    await act(admin, { type: 'finishGame' });
    const fin = await screen.waitFor((s) => s.game.status === 'FINISHED');
    assert.equal(fin.teams[0].team, 'Тулпар');
    // Эң мыкты оюнчу — упай алган Темир (2-тур жана финал эсептелбейт)
    assert.equal(fin.standings[0].name, 'Темир');
    assert.equal(fin.standings[0].reached, 'ROUND1');
  });
});
