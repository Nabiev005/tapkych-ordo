/** Студенттин кабинети: кирүү коду, күндүн суроолору, серия, машыгуу; жана оюн пакеттери */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { adminLogin, api, startServer, type TestServer } from './helpers.js';
import { STARTER_PACKS, PACK_SIZES, STARTER_LIBRARY, buildPack } from '../src/library/starter.js';
import { bishkekDay } from '../src/routes/me.js';

let srv: TestServer;
let base: string;
let admin: string;
/** Китепкананын бардык суроолору (туура жооптору менен — текшерүү үчүн) */
let correctOf: Map<number, string>;

before(async () => {
  srv = await startServer('me');
  base = srv.url;
  admin = await adminLogin(base);
});
after(() => srv?.stop());

describe('баштапкы пакеттер', () => {
  it('buildPack: ар бир тур толук, кайталанбайт, финалда кыйындар биринчи', () => {
    const pool = STARTER_LIBRARY.map((q, i) => ({ ...q, id: i + 1 }));
    for (const p of STARTER_PACKS) {
      const items = buildPack(pool, p.categories);
      for (const r of ['ROUND1', 'ROUND2', 'FINAL'] as const) assert.equal(items.filter((i) => i.round === r).length, PACK_SIZES[r], `${p.title} ${r}`);
      assert.equal(new Set(items.map((i) => i.id)).size, items.length);
      const cats = new Set(items.map((i) => pool[i.id - 1].category));
      assert.ok([...cats].every((c) => p.categories.includes(c)));
      assert.equal(pool[items.find((i) => i.round === 'FINAL')!.id - 1].difficulty, 'HARD');
    }
  });

  it('баштапкы топтом пакеттерди түзөт; мугалим ырастала элек пакетти көрбөйт', async () => {
    const r = await api(base, 'POST', '/api/library/starter', { token: admin });
    assert.equal(r.body.packs, STARTER_PACKS.length);
    assert.equal((await api(base, 'POST', '/api/library/starter', { token: admin })).body.packs, 0, 'кайра түзүлбөйт');
    const packs = (await api(base, 'GET', '/api/library/packs', { token: admin })).body.packs;
    assert.equal(packs.length, STARTER_PACKS.length);
    assert.equal(packs[0].total, 0);
    assert.equal(packs[0].pending, 25);

    await api(base, 'POST', '/api/teachers', { token: admin, body: { username: 'packt', name: 'Пакет', password: 'secret12' } });
    const t = (await api(base, 'POST', '/api/auth/login', { body: { username: 'packt', password: 'secret12' } })).body.token;
    assert.equal((await api(base, 'GET', '/api/library/packs', { token: t })).body.packs.length, 0);
  });

  it('бардыгы ырасталгандан кийин: пакет банкка өз турлары менен көчөт, кайра көчпөйт', async () => {
    const all = (await api(base, 'GET', '/api/library?status=PENDING&limit=200', { token: admin })).body.items;
    await api(base, 'POST', '/api/library/approve', { token: admin, body: { ids: all.map((x: any) => x.id) } });
    correctOf = new Map(all.map((x: any) => [x.id, x.correct]));

    const t = (await api(base, 'POST', '/api/auth/login', { body: { username: 'packt', password: 'secret12' } })).body.token;
    const packs = (await api(base, 'GET', '/api/library/packs', { token: t })).body.packs;
    assert.equal(packs.length, 3);
    assert.deepEqual(packs[0].counts, { ROUND1: 10, ROUND2: 10, FINAL: 5 });
    assert.equal(packs[0].pending, 0);

    const r = await api(base, 'POST', `/api/library/packs/${packs[0].id}/copy`, { token: t });
    assert.equal(r.body.copied, 25);
    assert.deepEqual(r.body.counts, { ROUND1: 10, ROUND2: 10, FINAL: 5 });
    assert.equal((await api(base, 'POST', `/api/library/packs/${packs[0].id}/copy`, { token: t })).body.copied, 0);
    assert.equal((await api(base, 'GET', '/api/library/packs', { token: t })).body.packs[0].inBank, 25);

    // Пакет менен дароо оюн башталса болот
    const g = await api(base, 'POST', '/api/games', { token: t, body: { players: ['А', 'Б'] } });
    assert.equal(g.status, 201);
  });

  it('пакет түзүү/өчүрүү — башкы алып баруучу гана; аталышы кайталанбайт', async () => {
    const t = (await api(base, 'POST', '/api/auth/login', { body: { username: 'packt', password: 'secret12' } })).body.token;
    const ids = [...correctOf.keys()].slice(0, 3);
    const body = { title: 'Тест пакет', icon: '🧪', items: ids.map((id, i) => ({ id, round: i ? 'ROUND1' : 'FINAL' })) };
    assert.equal((await api(base, 'POST', '/api/library/packs', { token: t, body })).status, 403);
    const r = await api(base, 'POST', '/api/library/packs', { token: admin, body });
    assert.equal(r.status, 201);
    assert.equal((await api(base, 'POST', '/api/library/packs', { token: admin, body })).body.error, 'DUPLICATE_NAME');
    const p = (await api(base, 'GET', '/api/library/packs', { token: admin })).body.packs.find((x: any) => x.title === 'Тест пакет');
    assert.deepEqual(p.counts, { ROUND1: 2, ROUND2: 0, FINAL: 1 });
    assert.equal((await api(base, 'DELETE', `/api/library/packs/${p.id}`, { token: t })).status, 403);
    assert.equal((await api(base, 'DELETE', `/api/library/packs/${p.id}`, { token: admin })).status, 200);
  });
});

describe('студенттин кабинети', () => {
  let code: string;
  let studentId: number;
  let token: string;
  let dailyIds: number[];

  before(async () => {
    const r = await api(base, 'POST', '/api/students', { token: admin, body: { lines: 'Айпери Асанова; ИТ-21\nБекзат Осмонов; ИТ-21' } });
    assert.equal(r.body.created, 2);
  });

  it('коддор түзүлөт: уникалдуу, окууга жеңил', async () => {
    const r = await api(base, 'POST', '/api/students/codes', { token: admin, body: {} });
    assert.equal(r.body.generated, 2);
    assert.equal((await api(base, 'POST', '/api/students/codes', { token: admin, body: {} })).body.generated, 0, 'бар коддор алмашпайт');
    const students = (await api(base, 'GET', '/api/students', { token: admin })).body.students;
    for (const s of students) assert.match(s.accessCode, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.notEqual(students[0].accessCode, students[1].accessCode);
    code = students.find((s: any) => s.name === 'Айпери Асанова').accessCode;
    studentId = students.find((s: any) => s.name === 'Айпери Асанова').id;
  });

  it('кирүү: ката код — 401, кичине тамга жана боштуктар менен да кирет', async () => {
    assert.equal((await api(base, 'POST', '/api/me/login', { body: { code: 'ZZZZZZ' } })).body.error, 'INVALID_CODE');
    const r = await api(base, 'POST', '/api/me/login', { body: { code: ` ${code.slice(0, 3).toLowerCase()} ${code.slice(3)} ` } });
    assert.equal(r.status, 200);
    assert.equal(r.body.student.name, 'Айпери Асанова');
    token = r.body.token;
  });

  it('токендер аралашпайт: студент админ API’сине, админ студент API’сине кире албайт', async () => {
    assert.equal((await api(base, 'GET', '/api/questions', { token })).status, 401);
    assert.equal((await api(base, 'GET', '/api/students', { token })).status, 401);
    assert.equal((await api(base, 'GET', '/api/me', { token: admin })).status, 401);
    assert.equal((await api(base, 'GET', '/api/me')).status, 401);
  });

  it('кабинет: серия 0, бүгүн аткара элек, 14 күндүк календарь', async () => {
    const r = await api(base, 'GET', '/api/me', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.streak, 0);
    assert.equal(r.body.todayDone, false);
    assert.equal(r.body.calendar.length, 14);
    assert.equal(r.body.calendar.at(-1).day, bishkekDay());
    assert.ok(r.body.categories.length >= 5);
  });

  it('күндүн суроолору: 5 суроо, туура жооп жөнөтүлбөйт, баарына бирдей', async () => {
    const r = await api(base, 'GET', '/api/me/daily', { token });
    assert.equal(r.body.done, false);
    assert.equal(r.body.questions.length, 5);
    for (const q of r.body.questions) assert.equal(q.correct, undefined);
    assert.ok(!JSON.stringify(r.body).includes('"correct"'));
    dailyIds = r.body.questions.map((q: any) => q.id);

    const other = (await api(base, 'POST', '/api/me/login', { body: { code: (await api(base, 'GET', '/api/students', { token: admin })).body.students.find((s: any) => s.name === 'Бекзат Осмонов').accessCode } })).body.token;
    assert.deepEqual((await api(base, 'GET', '/api/me/daily', { token: other })).body.questions.map((q: any) => q.id), dailyIds);
  });

  it('машыгууда бүгүнкү күндүн суроолору чыкпайт жана текшерилбейт', async () => {
    for (let i = 0; i < 5; i++) {
      const p = await api(base, 'GET', '/api/me/practice', { token });
      assert.equal(p.body.questions.length, 10);
      assert.ok(p.body.questions.every((q: any) => !dailyIds.includes(q.id)));
    }
    const cheat = await api(base, 'POST', '/api/me/practice', { token, body: { answers: dailyIds.map((id) => ({ id, choice: 'A' })) } });
    assert.equal(cheat.body.error, 'NO_QUESTIONS');
  });

  it('күндүн суроолорун тапшыруу: сервер текшерет, серия 1, кайра тапшырууга болбойт', async () => {
    // 3 туура, 1 ката, 1 жооп жок
    const answers = dailyIds.slice(0, 4).map((id, i) => {
      const c = correctOf.get(id)!;
      return { id, choice: i < 3 ? c : c === 'A' ? 'B' : 'A' };
    });
    const r = await api(base, 'POST', '/api/me/daily', { token, body: { answers } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.correct, 3);
    assert.equal(r.body.total, 5);
    assert.equal(r.body.streak, 1);
    assert.equal(r.body.items.length, 5);
    assert.equal(r.body.items[4].choice, null);
    assert.equal(r.body.items[4].isCorrect, false);
    assert.equal(r.body.items[0].correct, correctOf.get(dailyIds[0]));

    assert.equal((await api(base, 'POST', '/api/me/daily', { token, body: { answers } })).body.error, 'ALREADY_SUBMITTED');
    const again = await api(base, 'GET', '/api/me/daily', { token });
    assert.equal(again.body.done, true);
    assert.equal(again.body.result.correct, 3);

    const me = await api(base, 'GET', '/api/me', { token });
    assert.equal(me.body.todayDone, true);
    assert.equal(me.body.streak, 1);
    assert.equal(me.body.calendar.at(-1).done, true);
  });

  it('машыгуу: тема боюнча, жыйынтык сакталат, кайталанган жооп бир жолу эсептелет', async () => {
    const cat = 'Математика';
    const p = await api(base, 'GET', `/api/me/practice?category=${encodeURIComponent(cat)}`, { token });
    assert.ok(p.body.questions.every((q: any) => q.category === cat));
    const first = p.body.questions[0];
    const answers = [
      { id: first.id, choice: correctOf.get(first.id)! },
      { id: first.id, choice: correctOf.get(first.id)! },
      ...p.body.questions.slice(1, 3).map((q: any) => ({ id: q.id, choice: 'Z' })),
    ];
    const r = await api(base, 'POST', '/api/me/practice', { token, body: { category: cat, answers } });
    assert.equal(r.body.correct, 1);
    assert.equal(r.body.total, 3);
    const me = await api(base, 'GET', '/api/me', { token });
    assert.equal(me.body.totals.practiceRuns, 1);
    assert.equal(me.body.recentPractice[0].category, cat);
    assert.equal((await api(base, 'GET', '/api/me/practice?category=Жок-тема', { token })).body.error, 'NO_QUESTIONS');
  });

  it('кодду жаңылоо: эски код менен кирүүгө болбойт', async () => {
    const r = await api(base, 'POST', `/api/students/${studentId}/code`, { token: admin });
    assert.notEqual(r.body.accessCode, code);
    assert.equal((await api(base, 'POST', '/api/me/login', { body: { code } })).status, 401);
    assert.equal((await api(base, 'POST', '/api/me/login', { body: { code: r.body.accessCode } })).status, 200);
  });

  it('студент өчүрүлсө, токени иштебей калат', async () => {
    await api(base, 'DELETE', `/api/students/${studentId}`, { token: admin });
    assert.equal((await api(base, 'GET', '/api/me', { token })).status, 401);
  });
});
