/** Мектептер аралык лига: турлар, катышуу, мектептердин упайы жана ачык таблица */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { adminLogin, api, choiceQuestion, startServer, type TestServer } from './helpers.js';

let srv: TestServer;
let base: string;
let admin: string;
let leagueId: number;
let leagueCode: string;
const S1 = '№1 мектеп';
const S2 = '№2 мектеп';
const S3 = '№3 мектеп';

before(async () => {
  srv = await startServer('league');
  base = srv.url;
  admin = await adminLogin(base);
  for (const text of ['Лига суроо 1', 'Лига суроо 2', 'Лига суроо 3']) {
    const r = await api(base, 'POST', '/api/questions', { token: admin, body: choiceQuestion('ROUND1', text, 'A') });
    assert.equal(r.status, 201, JSON.stringify(r.body));
  }
});
after(() => srv?.stop());

/** Катышуучу турду бүтүрөт: алгачкы `correct` суроого туура (A), калганына ката (B) жооп берет */
async function play(code: string, name: string, school: string, correct: number) {
  const start = await api(base, 'POST', `/api/hw/${code}/start`, { body: { name, school } });
  assert.equal(start.status, 201, JSON.stringify(start.body));
  const { token } = start.body;
  let s = (await api(base, 'GET', `/api/hw/session/${token}`)).body;
  for (let i = 0; !s.finished; i++) {
    s = (await api(base, 'POST', `/api/hw/session/${token}/answer`, { body: { number: s.question.number, choice: i < correct ? 'A' : 'B' } })).body;
  }
  return token as string;
}

async function newRound(title: string) {
  const r = await api(base, 'POST', `/api/leagues/${leagueId}/rounds`, { token: admin, body: { title, timerSeconds: 30, auto: { count: 3 } } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.round as { id: number; code: string };
}

describe('мектептер аралык лига', () => {
  it('лига түзүлөт; кеминде 2 мектеп талап кылынат', async () => {
    const bad = await api(base, 'POST', '/api/leagues', { token: admin, body: { title: 'X', schools: [S1] } });
    assert.equal(bad.status, 400);
    const r = await api(base, 'POST', '/api/leagues', { token: admin, body: { title: 'Күзгү лига', schools: [S1, S2, S3, ` ${S1} `], topN: 2 } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    leagueId = r.body.league.id;
    leagueCode = r.body.league.code;
    assert.match(leagueCode, /^[A-Z0-9]{6}$/);
    const l = (await api(base, 'GET', `/api/leagues/${leagueId}`, { token: admin })).body.league;
    assert.deepEqual(l.schools, [S1, S2, S3]);
  });

  it('1-тур: мектептин упайы — эң мыкты topN катышуучунун суммасы', async () => {
    const round = await newRound('1-тур');
    // Ачык маалымат: студенттер тизмеси эмес, лиганын мектептери берилет
    const info = (await api(base, 'GET', `/api/hw/${round.code}`)).body;
    assert.deepEqual(info.students, []);
    assert.deepEqual(info.league, { title: 'Күзгү лига', code: leagueCode, schools: [S1, S2, S3] });

    assert.equal((await api(base, 'POST', `/api/hw/${round.code}/start`, { body: { name: 'Бөтөн', school: 'Башка мектеп' } })).status, 400);

    const asan = await play(round.code, 'Асан', S1, 3);
    await play(round.code, 'Үсөн', S1, 2);
    await play(round.code, 'Бакыт', S1, 1);
    await play(round.code, 'Айгүл', S2, 3);

    // Ошол эле мектептен ошол эле ат менен (башка регистр) — мурунку жыйынтык ачылат
    const again = await api(base, 'POST', `/api/hw/${round.code}/start`, { body: { name: '  асан ', school: S1 } });
    assert.equal(again.body.token, asan);
    assert.equal(again.body.finished, true);

    const l = (await api(base, 'GET', `/api/leagues/${leagueId}`, { token: admin })).body.league;
    assert.deepEqual(
      l.rounds[0].schools.map((s: any) => [s.school, s.participants, s.score, s.place, s.points]),
      [
        [S1, 3, 5, 1, 10],
        [S2, 1, 3, 2, 8],
        [S3, 0, 0, 0, 0],
      ],
    );
  });

  it('2-тур жана лиганын таблицасы: упай бирдей болсо — турлардагы упайлардын суммасы чечет', async () => {
    const round = await newRound('2-тур');
    await play(round.code, 'Айгүл', S2, 3);
    await play(round.code, 'Нурлан', S2, 3);
    await play(round.code, 'Асан', S1, 1);

    const pub = await api(base, 'GET', `/api/league/${leagueCode.toLowerCase()}`);
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    const l = pub.body.league;
    assert.equal(l.id, undefined);
    assert.ok(l.rounds.every((r: any) => r.id === undefined && r.code && r.open));
    assert.deepEqual(
      l.standings.map((s: any) => [s.school, s.place, s.points, s.score, s.rounds, s.participants]),
      [
        [S2, 1, 18, 9, 2, 3],
        [S1, 2, 18, 6, 2, 4],
        [S3, 3, 0, 0, 0, 0],
      ],
    );
    assert.deepEqual(
      l.topPlayers.map((p: any) => [p.name, p.school, p.score, p.rounds]),
      [
        ['Айгүл', S2, 6, 2],
        ['Асан', S1, 4, 2],
        ['Нурлан', S2, 3, 1],
        ['Үсөн', S1, 2, 1],
        ['Бакыт', S1, 1, 1],
      ],
    );
  });

  it('жабылган турга жаңы катышуучу кире албайт; лиганын турлары тапшырмалар тизмесинде жок', async () => {
    const l = (await api(base, 'GET', `/api/leagues/${leagueId}`, { token: admin })).body.league;
    await api(base, 'PATCH', `/api/assignments/${l.rounds[0].id}`, { token: admin, body: { active: false } });
    const late = await api(base, 'POST', `/api/hw/${l.rounds[0].code}/start`, { body: { name: 'Кечиккен', school: S3 } });
    assert.equal(late.status, 400);
    assert.equal(late.body.error, 'ASSIGNMENT_CLOSED');
    assert.equal((await api(base, 'GET', '/api/assignments', { token: admin })).body.assignments.length, 0);
    const list = (await api(base, 'GET', '/api/leagues', { token: admin })).body.leagues;
    assert.deepEqual(list.map((x: any) => [x.title, x.schools, x.rounds, x.participants]), [['Күзгү лига', 3, 2, 7]]);
  });

  it('мугалим башка бирөөнүн лигасын көрө албайт; өчүрүлгөндө турлары кошо өчөт', async () => {
    await api(base, 'POST', '/api/teachers', { token: admin, body: { username: 'liga_t', name: 'Мугалим', password: 'secret12' } });
    const t = (await api(base, 'POST', '/api/auth/login', { body: { username: 'liga_t', password: 'secret12' } })).body.token;
    assert.deepEqual((await api(base, 'GET', '/api/leagues', { token: t })).body.leagues, []);
    assert.equal((await api(base, 'GET', `/api/leagues/${leagueId}`, { token: t })).status, 404);

    const l = (await api(base, 'GET', `/api/leagues/${leagueId}`, { token: admin })).body.league;
    assert.equal((await api(base, 'DELETE', `/api/leagues/${leagueId}`, { token: admin })).status, 200);
    assert.equal((await api(base, 'GET', `/api/hw/${l.rounds[0].code}`)).status, 404);
    assert.equal((await api(base, 'GET', `/api/league/${leagueCode}`)).status, 404);
  });
});
