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
    // Телефондо: «Сиз N-болуп бастыңыз» (кадимки режимде туура/ката жок)
    const me1 = await p[1].waitFor((s) => s.myPress?.place === 1);
    assert.deepEqual(me1.myPress, { place: 1, status: null, queue: null });
    assert.equal((await p[2].waitFor((s) => s.myPress)).myPress.place, 2);
    assert.equal(sc.game.buzzer, false);

    await act(admin, { type: 'revealAnswer' });
    const rv = await screen.waitFor((s) => s.game.phase === 'REVEAL');
    assert.equal(rv.pressOrder.length, 3);
    assert.equal(rv.players.find((x: any) => x.id === ids[1]).correct, false);
  });
});

describe('финал: «биринчи баскан жооп берет» режими', () => {
  let gameId: number;
  let admin: Client;
  let screen: Client;
  const p: Client[] = [];
  const ids: number[] = [];

  before(async () => {
    for (const [round, text] of [['ROUND1', 'Б1'], ['ROUND2', 'Б2'], ['FINAL', 'БФ1'], ['FINAL', 'БФ2']] as const) {
      await api(base, 'POST', '/api/questions', { token, body: choiceQuestion(round, text, 'A') });
    }
    const settings = { round1Count: 1, round2Count: 1, finalQuestionCount: 2, advanceToRound2: 3, advanceToFinal: 3, timerSeconds: 30, pointsPerCorrect: 5, finalBuzzer: true, introEnabled: false };
    const g = await api(base, 'POST', '/api/games', { token, body: { players: ['Эрмек', 'Гүлзат', 'Данияр'], settings } });
    assert.equal(g.status, 201, JSON.stringify(g.body));
    assert.equal(g.body.game.finalBuzzer, true);
    gameId = g.body.game.id;
    admin = connect({ role: 'admin', token, gameId });
    screen = connect({ role: 'screen', code: g.body.game.code });
    await Promise.all([admin.connected(), screen.connected()]);
    for (const pl of g.body.game.players) {
      ids.push(pl.id);
      const r = await api(base, 'POST', '/api/join', { body: { code: g.body.game.code, pin: pl.pin } });
      const c = connect({ role: 'player', token: r.body.token });
      await c.connected();
      p.push(c);
    }
  });

  it('1-турда режим иштебейт: баскыч жок, кадимки жооп', async () => {
    await act(admin, { type: 'startGame' });
    await act(admin, { type: 'nextQuestion' });
    await act(admin, { type: 'showQuestion' });
    const sc = await screen.waitFor((s) => s.game.phase === 'QUESTION');
    assert.equal(sc.game.buzzer, false);
    assert.equal((await p[0].emit('player:buzz', {})).error, 'INVALID_ACTION');
    assert.equal((await p[0].emit('player:answer', { choice: 'A' })).ok, true);
    await act(admin, { type: 'revealAnswer' });
    await act(admin, { type: 'endRound' });
    await act(admin, { type: 'confirmAdvance', playerIds: ids });
    await playQuestion(admin);
    await act(admin, { type: 'endRound' });
    await act(admin, { type: 'confirmAdvance', playerIds: ids });
    await admin.waitFor((s) => s.game.status === 'FINAL');
  });

  it('финал: басуу кезеги, ката → кийинкиге, туура → упай жана REVEAL', async () => {
    await act(admin, { type: 'nextQuestion' });
    await act(admin, { type: 'showQuestion' });
    const sc0 = await screen.waitFor((s) => s.game.phase === 'QUESTION');
    assert.equal(sc0.game.buzzer, true);
    assert.equal((await p[0].emit('player:answer', { choice: 'A' })).error, 'INVALID_ACTION');
    assert.equal((await admin.emit('admin:action', { type: 'judgeBuzz', correct: true })).error, 'INVALID_ACTION');

    assert.equal((await p[1].emit('player:buzz', {})).ok, true);
    await sleep(40);
    assert.equal((await p[0].emit('player:buzz', {})).ok, true);
    assert.equal((await p[1].emit('player:buzz', {})).error, 'ALREADY_ANSWERED');

    const sc = await screen.waitFor((s) => s.pressOrder?.length === 2);
    assert.deepEqual(sc.pressOrder.map((x: any) => [x.name, x.status]), [['Гүлзат', 'pending'], ['Эрмек', 'pending']]);
    assert.equal(sc.question.correct, null);
    assert.deepEqual((await p[1].waitFor((s) => s.myPress)).myPress, { place: 1, status: 'pending', queue: 1 });
    assert.equal((await p[0].waitFor((s) => s.myPress)).myPress.queue, 2);

    // Гүлзат ката айтты — кезек Эрмекке өтөт, суроо уланат
    await act(admin, { type: 'judgeBuzz', correct: false });
    const after = await screen.waitFor((s) => s.pressOrder?.[0]?.status === 'wrong');
    assert.equal(after.game.phase, 'QUESTION');
    assert.equal(after.question.correct, null);
    assert.deepEqual((await p[0].waitFor((s) => s.myPress?.queue === 1)).myPress, { place: 2, status: 'pending', queue: 1 });

    // Эрмек туура айтты — упай, туура жооп ачылат
    await act(admin, { type: 'judgeBuzz', correct: true });
    const rv = await screen.waitFor((s) => s.game.phase === 'REVEAL');
    assert.deepEqual(rv.pressOrder.map((x: any) => x.status), ['wrong', 'correct']);
    assert.equal(rv.question.correct, 'A');
    const me0 = await p[0].waitFor((s) => s.game.phase === 'REVEAL');
    assert.equal(me0.question.myCorrect, true);
    assert.equal(me0.question.myPoints, 5);
    const me1 = await p[1].waitFor((s) => s.game.phase === 'REVEAL');
    assert.equal(me1.question.myCorrect, false);
    const ad = await admin.waitFor((s) => s.game.phase === 'REVEAL');
    assert.equal(ad.leaderboard.find((r: any) => r.playerId === ids[0]).score, 5);
  });

  it('эч ким туура айтпаса — алып баруучу өзү ачат', async () => {
    await act(admin, { type: 'nextQuestion' });
    await act(admin, { type: 'showQuestion' });
    await p[2].waitFor((s) => s.game.phase === 'QUESTION');
    assert.equal((await p[2].emit('player:buzz', {})).ok, true);
    await act(admin, { type: 'judgeBuzz', correct: false });
    assert.equal((await admin.emit('admin:action', { type: 'judgeBuzz', correct: true })).error, 'INVALID_ACTION');
    await act(admin, { type: 'revealAnswer' });
    const rv = await screen.waitFor((s) => s.game.phase === 'REVEAL');
    assert.deepEqual(rv.pressOrder.map((x: any) => x.status), ['wrong']);
  });
});

describe('ачык жооп: салыштыруу', () => {
  it('чоң/кичине тамга, тыныш белгилер, ң/ө/ү жана кичине каталар', async () => {
    const { checkOpen, normalizeOpen } = await import('../src/game/openAnswer.js');
    assert.equal(normalizeOpen('  «Жакып»!  '), 'жакып');
    assert.equal(normalizeOpen('Үч-Көл'), 'уч кол');
    assert.ok(checkOpen(['Жакып'], 'жакып'));
    assert.ok(checkOpen(['Жакып'], 'Жакыб')); // 5 белги — 1 ката кабыл
    assert.ok(!checkOpen(['Жакып'], 'Жакыбы1'));
    assert.ok(checkOpen(['Ысык-Көл'], 'ысык кол'));
    assert.ok(checkOpen(['Айтматов'], 'Айтматоф'));
    assert.ok(checkOpen(['Чыңгыз Айтматов'], 'чынгыз айтматв'));
    assert.ok(!checkOpen(['Ош'], 'Ыш')); // кыска сөз — так дал келиши керек
    assert.ok(!checkOpen(['1991'], '1992')); // сандар так
    assert.ok(checkOpen(['Жакып', 'Жакып хан'], 'жакып хан'));
    assert.ok(!checkOpen(['Жакып'], '   '));
  });
});

describe('ачык жооп: оюнда', () => {
  let admin: Client;
  let screen: Client;
  let audience: Client;
  const p: Client[] = [];
  const ids: number[] = [];

  before(async () => {
    const open = { round: 'ROUND1', type: 'OPEN', text: 'Манастын атасы ким?', optionA: 'Жакып', optionB: 'Жакып хан', optionC: '', optionD: '', correct: '' };
    const r = await api(base, 'POST', '/api/questions', { token, body: open });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.question?.correct ?? 'A', 'A');
    // Жообу жок ачык суроо кабыл алынбайт
    assert.equal((await api(base, 'POST', '/api/questions', { token, body: { ...open, text: 'башка', optionA: '' } })).status, 400);
    // Китепканага ачык суроо кошулбайт
    assert.equal((await api(base, 'POST', '/api/library', { token, body: { ...open, text: 'китеп' } })).status, 400);
    for (const [round, text] of [['ROUND2', 'А2'], ['FINAL', 'АФ']] as const) await api(base, 'POST', '/api/questions', { token, body: choiceQuestion(round, text, 'A') });

    const settings = { round1Count: 1, round2Count: 1, finalQuestionCount: 1, advanceToRound2: 3, advanceToFinal: 3, timerSeconds: 30, pointsPerCorrect: 2, introEnabled: false };
    const g = await api(base, 'POST', '/api/games', { token, body: { players: ['Нургүл', 'Таалай', 'Бекзат'], settings } });
    admin = connect({ role: 'admin', token, gameId: g.body.game.id });
    screen = connect({ role: 'screen', code: g.body.game.code });
    audience = connect({ role: 'audience', code: g.body.game.code, voterId: 'voter-open-1234' });
    await Promise.all([admin.connected(), screen.connected(), audience.connected()]);
    for (const pl of g.body.game.players) {
      ids.push(pl.id);
      const j = await api(base, 'POST', '/api/join', { body: { code: g.body.game.code, pin: pl.pin } });
      const c = connect({ role: 'player', token: j.body.token });
      await c.connected();
      p.push(c);
    }
    await act(admin, { type: 'startGame' });
    await act(admin, { type: 'nextQuestion' });
    await act(admin, { type: 'showQuestion' });
  });

  it('туура жооп REVEAL чейин эч кимге жетпейт', async () => {
    const ps = await p[0].waitFor((s) => s.game.phase === 'QUESTION');
    assert.equal(ps.question.type, 'OPEN');
    assert.equal(ps.question.text, 'Манастын атасы ким?');
    assert.deepEqual(ps.question.options, { A: '', B: '', C: '', D: '' });
    const sc = await screen.waitFor((s) => s.game.phase === 'QUESTION');
    assert.deepEqual(sc.question.options, { A: '', B: '', C: '', D: '' });
    const au = await audience.waitFor((s) => s.game.phase === 'QUESTION');
    assert.deepEqual(au.question.options, { A: '', B: '', C: '', D: '' });
    const ad = await admin.waitFor((s) => s.game.phase === 'QUESTION');
    assert.equal(ad.question.options.A, 'Жакып');
  });

  it('жооптор текшерилет; алып баруучу кол менен оңдой алат', async () => {
    assert.equal((await p[0].emit('player:answer', { choice: '  жакыб ' })).ok, true);
    assert.equal((await p[1].emit('player:answer', { choice: 'Жакып-хан' })).ok, true);
    assert.equal((await p[2].emit('player:answer', { choice: 'Бакай' })).ok, true);
    assert.equal((await p[0].emit('player:answer', { choice: 'x'.repeat(101) })).error, 'BAD_REQUEST');
    assert.equal((await audience.emit('audience:vote', { choice: 'A' })).error, 'BAD_REQUEST');
    const ad = await admin.waitFor((s) => Object.keys(s.answers).length === 3);
    assert.equal(ad.answers[ids[0]].choice, 'жакыб');
    assert.equal(ad.answers[ids[0]].isCorrect, true);
    assert.equal(ad.answers[ids[1]].isCorrect, true);
    assert.equal(ad.answers[ids[2]].isCorrect, false);
    // Бакай деген жоопту алып баруучу туура деп эсептеди (мисал)
    await act(admin, { type: 'markAnswer', playerId: ids[2], correct: true });
    await admin.waitFor((s) => s.answers[ids[2]].isCorrect === true);
    await act(admin, { type: 'markAnswer', playerId: ids[2], correct: false });
    await admin.waitFor((s) => s.answers[ids[2]].isCorrect === false);
  });

  it('REVEAL: туура жооп жана оюнчулардын жазгандары экранда', async () => {
    await act(admin, { type: 'revealAnswer' });
    const sc = await screen.waitFor((s) => s.game.phase === 'REVEAL');
    assert.equal(sc.question.options.A, 'Жакып');
    assert.equal(sc.question.stats, null);
    assert.equal(sc.players.find((x: any) => x.id === ids[1]).text, 'Жакып-хан');
    assert.equal(sc.players.find((x: any) => x.id === ids[2]).correct, false);
    const me = await p[0].waitFor((s) => s.game.phase === 'REVEAL');
    assert.equal(me.question.myCorrect, true);
    assert.equal(me.question.myPoints, 2);
    // REVEAL'дан кийин да оңдосо болот — упай кайра эсептелет
    await act(admin, { type: 'markAnswer', playerId: ids[2], correct: true });
    const ad = await admin.waitFor((s) => s.leaderboard.find((r: any) => r.playerId === ids[2])?.score === 2);
    assert.ok(ad);
  });
});
