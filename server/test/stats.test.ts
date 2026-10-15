/** Суроолордун статистикасы: тактык боюнча иреттөө (жооп саны жетиштүү болгондо) */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { adminLogin, api, startServer, type TestServer } from './helpers.js';

let srv: TestServer;
let base: string;
let admin: string;

before(async () => {
  srv = await startServer('stats');
  base = srv.url;
  admin = await adminLogin(base);
});
after(() => srv?.stop());

const list = (query: string) => api(base, 'GET', `/api/library?category=${encodeURIComponent('Стат')}${query}`, { token: admin });

describe('тактык боюнча иреттөө', () => {
  it('эң кыйын жана эң жеңил суроолор туура иреттелет; маалымат аз суроолор аягында', async () => {
    // Китепканада 3 гана суроо — баары «Күндүн суроолоруна» кирет.
    // 6 студент: «Жеңил» — 6/6 туура, «Орто» — 3/6, «Кыйын» — 1/6
    for (const text of ['Жеңил суроо', 'Орто суроо', 'Кыйын суроо']) {
      const r = await api(base, 'POST', '/api/library', { token: admin, body: { type: 'TF', category: 'Стат', text, correct: 'A' } });
      assert.equal(r.status, 201);
    }
    const items = (await list('')).body.items;
    const id = (t: string) => items.find((x: any) => x.text === t).id;

    await api(base, 'POST', '/api/students', { token: admin, body: { lines: Array.from({ length: 6 }, (_, i) => `Студент ${i + 1}; С-1`).join('\n') } });
    await api(base, 'POST', '/api/students/codes', { token: admin, body: {} });
    const students = (await api(base, 'GET', '/api/students', { token: admin })).body.students;
    for (const [i, s] of students.entries()) {
      const token = (await api(base, 'POST', '/api/me/login', { body: { code: s.accessCode } })).body.token;
      const answers = [
        { id: id('Жеңил суроо'), choice: 'A' },
        { id: id('Орто суроо'), choice: i < 3 ? 'A' : 'B' },
        { id: id('Кыйын суроо'), choice: i === 0 ? 'A' : 'B' },
      ];
      const r = await api(base, 'POST', '/api/me/daily', { token, body: { answers } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
    }
    // Жооп берилбеген суроо — иреттөөдө аягында
    await api(base, 'POST', '/api/library', { token: admin, body: { type: 'TF', category: 'Стат', text: 'Жаңы суроо', correct: 'A' } });

    const texts = async (q: string) => (await list(q)).body.items.map((x: any) => x.text);
    assert.deepEqual(await texts('&sort=hard'), ['Кыйын суроо', 'Орто суроо', 'Жеңил суроо', 'Жаңы суроо']);
    assert.deepEqual(await texts('&sort=easy'), ['Жеңил суроо', 'Орто суроо', 'Кыйын суроо', 'Жаңы суроо']);

    const stats = Object.fromEntries((await list('')).body.items.map((x: any) => [x.text, x.stats]));
    assert.deepEqual(stats['Жеңил суроо'], { answered: 6, correct: 6 });
    assert.deepEqual(stats['Орто суроо'], { answered: 6, correct: 3 });
    assert.deepEqual(stats['Кыйын суроо'], { answered: 6, correct: 1 });
    assert.deepEqual(stats['Жаңы суроо'], { answered: 0, correct: 0 });
  });

  it('иреттөө баракчалар менен иштейт (offset/limit)', async () => {
    const p1 = (await list('&sort=hard&limit=1')).body;
    const p2 = (await list('&sort=hard&limit=1&offset=1')).body;
    assert.equal(p1.total, 4);
    assert.equal(p1.items[0].text, 'Кыйын суроо');
    assert.equal(p2.items[0].text, 'Орто суроо');
  });

  it('топтордун жумалык рейтинги жана серия чемпиондору', async () => {
    // Топсуз студент жана экинчи топ (аткарган жок) — топсуз рейтингге кирбейт, 2-топ 0% менен аягында
    await api(base, 'POST', '/api/students', { token: admin, body: { lines: 'Топсуз Студент\nЭкинчи Топтогу; С-2' } });
    const r = await api(base, 'GET', '/api/students/activity', { token: admin });
    assert.equal(r.status, 200);
    assert.deepEqual(
      r.body.groups.map((g: any) => [g.className, g.place, g.members, g.active, g.completions, g.activity, g.accuracy]),
      [
        ['С-1', 1, 6, 6, 6, 14, 56],
        ['С-2', 2, 1, 0, 0, 0, 0],
      ],
    );
    assert.equal(r.body.streaks.length, 6);
    assert.ok(r.body.streaks.every((s: any) => s.streak === 1 && s.className === 'С-1'));

    const s = (await api(base, 'GET', '/api/students', { token: admin })).body.students.find((x: any) => x.className === 'С-1');
    const token = (await api(base, 'POST', '/api/me/login', { body: { code: s.accessCode } })).body.token;
    const me = await api(base, 'GET', '/api/me/leaderboard', { token });
    assert.equal(me.body.myGroup, 'С-1');
    assert.equal(me.body.myId, s.id);
    assert.equal(me.body.groups[0].className, 'С-1');
    // Студент мугалимдин маршрутуна кире албайт
    assert.equal((await api(base, 'GET', '/api/students/activity', { token })).status, 401);
  });

  it('күндүн суроолорун аткаргандан кийин аларды машыгууда да колдонсо болот', async () => {
    const s = (await api(base, 'GET', '/api/students', { token: admin })).body.students.find((x: any) => x.className === 'С-1');
    const token = (await api(base, 'POST', '/api/me/login', { body: { code: s.accessCode } })).body.token;
    const p = await api(base, 'GET', `/api/me/practice?category=${encodeURIComponent('Стат')}`, { token });
    assert.equal(p.status, 200, JSON.stringify(p.body));
    assert.equal(p.body.questions.length, 4);
  });
});
