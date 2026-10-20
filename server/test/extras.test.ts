/**
 * Интро, оюн учурунда суроолордун санын өзгөртүү жана финалда ким биринчи басканы.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Client, adminLogin, api, choiceQuestion, sleep, startServer, type TestServer } from './helpers.js';

let srv: TestServer;
let base: string;
let token: string;
const clients: Client[] = [];

before(async () => {
  srv = await startServer('extras');
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

/** Бир суроону толук өткөрүү: номер → суроо → ачуу */
async function playQuestion(admin: Client) {
  await act(admin, { type: 'nextQuestion' });
  await act(admin, { type: 'showQuestion' });
  await act(admin, { type: 'revealAnswer' });
}

describe('интро, суроолордун саны, финалдагы басуу тартиби', () => {
  let gameId: number;
  let code: string;
  let admin: Client;
  let screen: Client;
  const p: Client[] = [];
  const ids: number[] = [];

  before(async () => {
    // Банк: 1-тур — 3, 2-тур — 2, финал — 2 суроо
    const bank: ['ROUND1' | 'ROUND2' | 'FINAL', string][] = [
      ['ROUND1', 'Т1-1'],
      ['ROUND1', 'Т1-2'],
      ['ROUND1', 'Т1-3'],
      ['ROUND2', 'Т2-1'],
      ['ROUND2', 'Т2-2'],
      ['FINAL', 'Ф-1'],
      ['FINAL', 'Ф-2'],
    ];
    for (const [round, text] of bank) {
      const r = await api(base, 'POST', '/api/questions', { token, body: choiceQuestion(round, text, 'A') });
      assert.equal(r.status, 201, JSON.stringify(r.body));
    }
    const settings = { round1Count: 2, round2Count: 1, finalQuestionCount: 1, advanceToRound2: 3, advanceToFinal: 3, timerSeconds: 10 };
    const g = await api(base, 'POST', '/api/games', { token, body: { players: ['Айдай', 'Бакыт', 'Чолпон'], settings } });
    assert.equal(g.status, 201, JSON.stringify(g.body));
    gameId = g.body.game.id;
    code = g.body.game.code;
    assert.equal(g.body.game.introEnabled, true);

    admin = connect({ role: 'admin', token, gameId });
    screen = connect({ role: 'screen', code });
    await Promise.all([admin.connected(), screen.connected()]);
    for (const pl of g.body.game.players) {
      ids.push(pl.id);
      const r = await api(base, 'POST', '/api/join', { body: { code, pin: pl.pin } });
      const c = connect({ role: 'player', token: r.body.token });
      await c.connected();
      p.push(c);
    }
  });

  it('интро жөндөөсү: видеонун дареги /uploads/ гана болушу керек', async () => {
    const bad = await api(base, 'PATCH', `/api/games/${gameId}/settings`, { token, body: { introVideoUrl: 'https://evil.example/x.mp4' } });
    assert.equal(bad.status, 400);
    const ok = await api(base, 'PATCH', `/api/games/${gameId}/settings`, { token, body: { introVideoUrl: '/uploads/abc.mp4' } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const sc = await screen.waitFor((s) => s.game.intro?.videoUrl === '/uploads/abc.mp4');
    assert.equal(sc.game.startedAt, null);
    await api(base, 'PATCH', `/api/games/${gameId}/settings`, { token, body: { introVideoUrl: null } });
    await screen.waitFor((s) => s.game.intro && s.game.intro.videoUrl === null);
  });

  it('лоббиде суроолордун санын өзгөртүү (PATCH), оюн башталганда экранга startedAt келет', async () => {
    const r = await api(base, 'PATCH', `/api/games/${gameId}/settings`, { token, body: { round1Count: 3 } });
    assert.equal(r.status, 200);
    await act(admin, { type: 'startGame' });
    const ad = await admin.waitFor((s) => s.game.status === 'ROUND1');
    assert.equal(ad.game.total, 3);
    const sc = await screen.waitFor((s) => s.game.status === 'ROUND1');
    assert.ok(sc.game.startedAt > 0);
    assert.deepEqual(sc.game.intro, { videoUrl: null });
    assert.equal(sc.pressOrder, null);
    // Банктын 7 суроосунан 5и оюнга алынды
    assert.equal(ad.spare, 2);
  });

  it('оюн учурунда азайтуу жана көбөйтүү', async () => {
    await act(admin, { type: 'setRoundCount', round: 'ROUND1', count: 2 });
    let ad = await admin.waitFor((s) => s.game.total === 2);
    assert.equal(ad.game.settings.round1Count, 2);
    assert.equal(ad.spare, 3);

    assert.equal((await admin.emit('admin:action', { type: 'setRoundCount', round: 'ROUND1', count: 0 })).error, 'BAD_REQUEST');
    assert.equal((await admin.emit('admin:action', { type: 'setRoundCount', round: 'ROUND9', count: 2 })).error, 'BAD_REQUEST');

    // Биринчи суроо көрсөтүлгөндөн кийин 1ден азайтууга болбойт, бирок 1ге болот
    await act(admin, { type: 'nextQuestion' });
    await act(admin, { type: 'showQuestion' });
    await act(admin, { type: 'setRoundCount', round: 'ROUND1', count: 1 });
    await admin.waitFor((s) => s.game.total === 1);

    // Көбөйтүү: адегенде ошол турдун суроолору алынат
    await act(admin, { type: 'setRoundCount', round: 'ROUND1', count: 3 });
    ad = await admin.waitFor((s) => s.game.total === 3);
    assert.equal(ad.spare, 2);

    const tooMany = await admin.emit('admin:action', { type: 'setRoundCount', round: 'ROUND1', count: 50 });
    assert.equal(tooMany.error, 'NOT_ENOUGH_QUESTIONS');
    assert.deepEqual(tooMany.details, { round: 'ROUND1', need: 50, have: 5 });

    // Кийинки турдун санын да алдын ала өзгөртсө болот
    await act(admin, { type: 'setRoundCount', round: 'ROUND2', count: 2 });
    ad = await admin.waitFor((s) => s.game.settings.round2Count === 2);
    assert.equal(ad.spare, 1);
  });

  it('1-турдун суроолорун бүтүрүү; бүткөн турдун санын өзгөртүүгө болбойт', async () => {
    await act(admin, { type: 'revealAnswer' });
    await playQuestion(admin);
    await playQuestion(admin);
    await act(admin, { type: 'endRound' });
    await admin.waitFor((s) => s.game.phase === 'ROUND_END');
    assert.equal((await admin.emit('admin:action', { type: 'setRoundCount', round: 'ROUND1', count: 4 })).error, 'INVALID_ACTION');
    await act(admin, { type: 'confirmAdvance', playerIds: ids });
    await admin.waitFor((s) => s.game.status === 'ROUND2' && s.game.total === 2);
    assert.equal((await admin.emit('admin:action', { type: 'setRoundCount', round: 'ROUND1', count: 1 })).error, 'INVALID_ACTION');
    await playQuestion(admin);
    await playQuestion(admin);
    await act(admin, { type: 'endRound' });
    await act(admin, { type: 'confirmAdvance', playerIds: ids });
    await admin.waitFor((s) => s.game.status === 'FINAL');
  });

  it('финал: экранда ким биринчи басканы көрүнөт (туура/ката REVEAL чейин жашыруун)', async () => {
    await act(admin, { type: 'nextQuestion' });
    await act(admin, { type: 'showQuestion' });
    await p[0].waitFor((s) => s.game.phase === 'QUESTION');
    const empty = await screen.waitFor((s) => s.game.phase === 'QUESTION');
    assert.deepEqual(empty.pressOrder, []);

    // Бакыт биринчи, Чолпон экинчи, Айдай үчүнчү басат
    assert.equal((await p[1].emit('player:answer', { choice: 'B' })).ok, true);
    await sleep(60);
    assert.equal((await p[2].emit('player:answer', { choice: 'A' })).ok, true);
    await sleep(60);
    assert.equal((await p[0].emit('player:answer', { choice: 'A' })).ok, true);

    const sc = await screen.waitFor((s) => s.pressOrder?.length === 3);
    assert.deepEqual(
      sc.pressOrder.map((x: any) => x.name),
      ['Бакыт', 'Чолпон', 'Айдай'],
    );
    assert.ok(sc.pressOrder[0].responseMs <= sc.pressOrder[1].responseMs);
    assert.ok(sc.pressOrder.every((x: any) => !('isCorrect' in x) && !('choice' in x)));
    assert.ok(sc.players.every((x: any) => x.correct === null));
    const ad = await admin.waitFor((s) => s.pressOrder?.length === 3);
    assert.equal(ad.pressOrder[0].playerId, ids[1]);

    await act(admin, { type: 'revealAnswer' });
    const rv = await screen.waitFor((s) => s.game.phase === 'REVEAL');
    assert.equal(rv.pressOrder.length, 3);
    assert.equal(rv.players.find((x: any) => x.id === ids[1]).correct, false);
  });
});
