/** Кирүү, уруксаттар жана мугалимдердин маалыматынын бөлүнүшү */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN, adminLogin, api, choiceQuestion, startServer, type TestServer } from './helpers.js';

let srv: TestServer;
let base: string;

before(async () => {
  srv = await startServer('auth');
  base = srv.url;
});
after(() => srv?.stop());

describe('алып баруучунун кирүүсү', () => {
  it('/api/health иштейт', async () => {
    const r = await api(base, 'GET', '/api/health');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
  });

  it('ката сыр сөз — 401 INVALID_CREDENTIALS', async () => {
    const r = await api(base, 'POST', '/api/auth/login', { body: { username: ADMIN.username, password: 'wrong' } });
    assert.equal(r.status, 401);
    assert.equal(r.body.error, 'INVALID_CREDENTIALS');
  });

  it('туура сыр сөз — токен; логиндин чоң/кичине тамгасы жана боштуктар эсепке алынбайт', async () => {
    const r = await api(base, 'POST', '/api/auth/login', { body: { username: ' ADMIN ', password: ` ${ADMIN.password} ` } });
    assert.equal(r.status, 200);
    assert.ok(r.body.token);
    assert.equal(r.body.user.role, 'admin');
    const me = await api(base, 'GET', '/api/auth/me', { token: r.body.token });
    assert.equal(me.status, 200);
  });

  it('токенсиз же жасалма токен менен корголгон маршруттар — 401', async () => {
    for (const url of ['/api/questions', '/api/games', '/api/students', '/api/teachers']) {
      assert.equal((await api(base, 'GET', url)).status, 401, url);
      assert.equal((await api(base, 'GET', url, { token: 'fake.token.here' })).status, 401, url);
    }
  });

  it('белгисиз API дареги — 404 NOT_FOUND', async () => {
    const token = await adminLogin(base);
    const r = await api(base, 'GET', '/api/no-such-route', { token });
    assert.equal(r.status, 404);
    assert.equal(r.body.error, 'NOT_FOUND');
  });
});

describe('мугалимдер', () => {
  let adminToken: string;
  let t1: string;
  let t2: string;

  before(async () => {
    adminToken = await adminLogin(base);
    for (const [username, name] of [
      ['teacher1', 'Айгүл'],
      ['teacher2', 'Бакыт'],
    ]) {
      const r = await api(base, 'POST', '/api/teachers', { token: adminToken, body: { username, name, password: 'secret12' } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
    }
    t1 = (await api(base, 'POST', '/api/auth/login', { body: { username: 'teacher1', password: 'secret12' } })).body.token;
    t2 = (await api(base, 'POST', '/api/auth/login', { body: { username: 'teacher2', password: 'secret12' } })).body.token;
    assert.ok(t1 && t2);
  });

  it('логин кайталанса — DUPLICATE_NAME', async () => {
    const r = await api(base, 'POST', '/api/teachers', { token: adminToken, body: { username: 'teacher1', name: 'X', password: 'secret12' } });
    assert.equal(r.status, 400);
    assert.equal(r.body.error, 'DUPLICATE_NAME');
  });

  it('мугалим мугалимдерди башкара албайт — 403 FORBIDDEN', async () => {
    const r = await api(base, 'GET', '/api/teachers', { token: t1 });
    assert.equal(r.status, 403);
    assert.equal(r.body.error, 'FORBIDDEN');
  });

  it('мугалим башка мугалимдин суроолорун көрбөйт жана өзгөртө албайт', async () => {
    const created = await api(base, 'POST', '/api/questions', { token: t1, body: choiceQuestion('ROUND1', 'Айгүлдүн суроосу') });
    assert.equal(created.status, 201);
    const qid = created.body.question.id;

    const own = await api(base, 'GET', '/api/questions', { token: t1 });
    assert.ok(own.body.questions.some((q: any) => q.id === qid));

    const other = await api(base, 'GET', '/api/questions', { token: t2 });
    assert.ok(!other.body.questions.some((q: any) => q.id === qid));

    const edit = await api(base, 'PUT', `/api/questions/${qid}`, { token: t2, body: choiceQuestion('ROUND1', 'Бузулду') });
    assert.equal(edit.status, 404);
    const del = await api(base, 'DELETE', `/api/questions/${qid}`, { token: t2 });
    assert.equal(del.status, 404);
  });

  it('мугалим башка мугалимдин оюнун ача албайт', async () => {
    const g = await api(base, 'POST', '/api/games', { token: t1, body: { players: ['А', 'Б'] } });
    assert.equal(g.status, 201);
    const gid = g.body.game.id;
    assert.equal((await api(base, 'GET', `/api/games/${gid}`, { token: t2 })).status, 404);
    assert.equal((await api(base, 'DELETE', `/api/games/${gid}`, { token: t2 })).status, 404);
    // Башкы алып баруучу баарын көрөт
    assert.equal((await api(base, 'GET', `/api/games/${gid}`, { token: adminToken })).status, 200);
  });

  it('ырастала элек мугалим кире албайт — TEACHER_PENDING', async () => {
    const r = await api(base, 'POST', '/api/teachers', { token: adminToken, body: { username: 'teacher3', name: 'Гүлзат', password: 'secret12' } });
    await api(base, 'PATCH', `/api/teachers/${r.body.teacher.id}`, { token: adminToken, body: { approved: false } });
    const login = await api(base, 'POST', '/api/auth/login', { body: { username: 'teacher3', password: 'secret12' } });
    assert.equal(login.status, 403);
    assert.equal(login.body.error, 'TEACHER_PENDING');
  });
});

describe('оюнчунун кирүүсү (PIN)', () => {
  let code: string;
  let pins: string[];

  before(async () => {
    const token = await adminLogin(base);
    const g = await api(base, 'POST', '/api/games', { token, body: { players: ['Азамат', 'Нургүл', 'Эрлан'] } });
    code = g.body.game.code;
    pins = g.body.game.players.map((p: any) => p.pin);
    assert.match(code, /^\d{6}$/);
    assert.equal(new Set(pins).size, 3, 'PIN коддор уникалдуу болушу керек');
  });

  it('аттар кайталанса оюн түзүлбөйт — DUPLICATE_NAME', async () => {
    const token = await adminLogin(base);
    const r = await api(base, 'POST', '/api/games', { token, body: { players: ['Айбек', 'айбек'] } });
    assert.equal(r.status, 400);
    assert.equal(r.body.error, 'DUPLICATE_NAME');
  });

  it('туура код жана PIN — токен', async () => {
    const r = await api(base, 'POST', '/api/join', { body: { code, pin: pins[0] } });
    assert.equal(r.status, 200);
    assert.equal(r.body.player.name, 'Азамат');
    assert.ok(r.body.token.length > 10);
  });

  it('ката PIN — 401, жок оюн — 404, туура эмес формат — 400', async () => {
    const wrong = String((Number(pins[0]) + 1) % 10000).padStart(4, '0');
    const badPin = pins.includes(wrong) ? '0000' : wrong;
    assert.equal((await api(base, 'POST', '/api/join', { body: { code, pin: badPin } })).body.error, 'INVALID_PIN');
    const missing = code === '999999' ? '999998' : '999999';
    assert.equal((await api(base, 'POST', '/api/join', { body: { code: missing, pin: pins[0] } })).status, 404);
    assert.equal((await api(base, 'POST', '/api/join', { body: { code: 'abc', pin: '12' } })).status, 400);
  });

  it('PIN тандап табуу бөгөттөлөт — TOO_MANY_ATTEMPTS', async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) {
      const pin = String(i).padStart(4, '0');
      if (pins.includes(pin)) continue;
      last = (await api(base, 'POST', '/api/join', { body: { code, pin } })).status;
    }
    assert.equal(last, 429);
  });
});
