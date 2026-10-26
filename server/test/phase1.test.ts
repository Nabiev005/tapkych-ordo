/**
 * 1-этап: суроонун өзүнчө убактысы, аралаштыруу, видео суроо, аватарлар, залдын реакциялары.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Client, adminLogin, api, choiceQuestion, sleep, startServer, type TestServer } from './helpers.js';

let srv: TestServer;
let base: string;
let token: string;
const clients: Client[] = [];

before(async () => {
  srv = await startServer('phase1');
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

describe('1-этап', () => {
  let admin: Client;
  let screen: Client;
  let audience: Client;
  let player: Client;
  let playerId: number;

  before(async () => {
    // 1-тур: видео жана 40 секунддук суроо
    const r = await api(base, 'POST', '/api/questions', {
      token,
      body: { ...choiceQuestion('ROUND1', 'Видео суроо'), videoUrl: '/uploads/clip.mp4', timerSeconds: 40 },
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal((await api(base, 'POST', '/api/questions', { token, body: { ...choiceQuestion('ROUND1', 'x'), timerSeconds: 2 } })).status, 400);
    for (let i = 1; i <= 6; i++) await api(base, 'POST', '/api/questions', { token, body: choiceQuestion('ROUND2', `Т2-${i}`) });
    await api(base, 'POST', '/api/questions', { token, body: choiceQuestion('FINAL', 'Ф') });

    const g = await api(base, 'POST', '/api/games', {
      token,
      body: { players: ['Айбек', 'Гүлнара'], settings: { round1Count: 1, round2Count: 6, finalQuestionCount: 1, advanceToRound2: 2, advanceToFinal: 2, timerSeconds: 15, shuffle: true, introEnabled: false } },
    });
    assert.equal(g.status, 201, JSON.stringify(g.body));
    assert.equal(g.body.game.shuffle, true);
    admin = connect({ role: 'admin', token, gameId: g.body.game.id });
    screen = connect({ role: 'screen', code: g.body.game.code });
    audience = connect({ role: 'audience', code: g.body.game.code, voterId: 'voter-phase1-123' });
    await Promise.all([admin.connected(), screen.connected(), audience.connected()]);
    playerId = g.body.game.players[0].id;
    const j = await api(base, 'POST', '/api/join', { body: { code: g.body.game.code, pin: g.body.game.players[0].pin } });
    player = connect({ role: 'player', token: j.body.token });
    await player.connected();
  });

  it('аватар: тизмедеги гана кабыл алынат, экранда көрүнөт', async () => {
    assert.equal((await player.emit('player:avatar', { avatar: 'dragon' })).error, 'BAD_REQUEST');
    assert.equal((await player.emit('player:avatar', { avatar: 'rocket' })).ok, true);
    const sc = await screen.waitFor((s) => s.players.some((p: any) => p.avatar === 'rocket'));
    assert.ok(sc);
    const me = await player.waitFor((s) => s.me?.avatar === 'rocket');
    assert.equal(me.me.avatar, 'rocket');
    const ad = await admin.waitFor((s) => s.players.find((p: any) => p.id === playerId)?.avatar === 'rocket');
    assert.ok(ad);
  });

  it('реакциялар экранга жетет, белгисизи жана тез-тез жиберилгени эмес', async () => {
    const got: string[] = [];
    screen.socket.on('reaction', (r: { kind: string }) => got.push(r.kind));
    audience.socket.emit('reaction', { kind: 'fire' });
    audience.socket.emit('reaction', { kind: 'heart' }); // 700 мс өтө элек — кабыл алынбайт
    player.socket.emit('reaction', { kind: 'bomb' }); // белгисиз
    await sleep(800);
    player.socket.emit('reaction', { kind: 'clap' });
    await sleep(300);
    assert.deepEqual(got, ['fire', 'clap']);
  });

  it('суроонун өзүнчө убактысы жана видеосу', async () => {
    await act(admin, { type: 'startGame' });
    await act(admin, { type: 'nextQuestion' });
    const ready = await screen.waitFor((s) => s.game.phase === 'READY');
    assert.equal(ready.question.videoUrl, null); // суроо көрсөтүлгөнгө чейин жашыруун
    await act(admin, { type: 'showQuestion' });
    const sc = await screen.waitFor((s) => s.game.phase === 'QUESTION');
    assert.equal(sc.game.timerSeconds, 40);
    assert.equal(sc.question.videoUrl, '/uploads/clip.mp4');
    const left = sc.game.endsAt - sc.serverNow;
    assert.ok(left > 35_000 && left <= 40_000, `калган убакыт: ${left}`);
    assert.equal((await player.waitFor((s) => s.game.phase === 'QUESTION')).game.timerSeconds, 40);
  });

  it('аралаштыруу: биринчи суроо оюндан оюнга өзгөрөт; өчүк болсо — банктагы тартип', async () => {
    for (let i = 1; i <= 6; i++) await api(base, 'POST', '/api/questions', { token, body: choiceQuestion('ROUND1', `С${i}`) });
    const firstOf = async (shuffle: boolean) => {
      const g = await api(base, 'POST', '/api/games', {
        token,
        body: { players: ['А', 'Б'], settings: { round1Count: 6, round2Count: 1, finalQuestionCount: 1, shuffle, introEnabled: false } },
      });
      const a = connect({ role: 'admin', token, gameId: g.body.game.id });
      await a.connected();
      await act(a, { type: 'startGame' });
      await act(a, { type: 'nextQuestion' }); // READY — суроо архивге өтпөйт
      const st = await a.waitFor((x) => x.game.phase === 'READY' && x.question);
      a.close();
      return st.question.text as string;
    };
    assert.equal(await firstOf(false), 'С1');
    assert.equal(await firstOf(false), 'С1');
    const firsts = new Set<string>();
    for (let i = 0; i < 8; i++) firsts.add(await firstOf(true));
    assert.ok(firsts.size > 1, `ар дайым бирдей: ${[...firsts]}`);
  });
});
