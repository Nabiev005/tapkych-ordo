/** Суроолор китепканасы: бөлүшүү → модерация → көчүрүү, уруксаттар, импорт, баштапкы топтом */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { adminLogin, api, choiceQuestion, startServer, type TestServer } from './helpers.js';
import { STARTER_LIBRARY } from '../src/library/starter.js';
import { questionSchema } from '../src/routes/questions.js';

let srv: TestServer;
let base: string;
let admin: string;
let t1: string;
let t2: string;

before(async () => {
  srv = await startServer('library');
  base = srv.url;
  admin = await adminLogin(base);
  for (const username of ['lib1', 'lib2']) {
    const r = await api(base, 'POST', '/api/teachers', { token: admin, body: { username, name: username, password: 'secret12' } });
    assert.equal(r.status, 201);
  }
  t1 = (await api(base, 'POST', '/api/auth/login', { body: { username: 'lib1', password: 'secret12' } })).body.token;
  t2 = (await api(base, 'POST', '/api/auth/login', { body: { username: 'lib2', password: 'secret12' } })).body.token;
});
after(() => srv?.stop());

const list = (token: string, query = '') => api(base, 'GET', `/api/library${query}`, { token });

describe('баштапкы топтом', () => {
  it('бардык суроолор схемадан өтөт жана тексттери кайталанбайт', () => {
    const texts = new Set<string>();
    for (const q of STARTER_LIBRARY) {
      assert.doesNotThrow(() => questionSchema.parse({ ...q, round: 'ROUND1' }), q.text);
      assert.ok(!texts.has(q.text), `кайталанган: ${q.text}`);
      texts.add(q.text);
    }
    assert.ok(STARTER_LIBRARY.length >= 100);
  });

  it('мугалим топтомду кошо албайт — 403', async () => {
    assert.equal((await api(base, 'POST', '/api/library/starter', { token: t1 })).status, 403);
  });

  it('башкы алып баруучу кошот: модерацияга түшөт, кайра кошулбайт', async () => {
    const r = await api(base, 'POST', '/api/library/starter', { token: admin });
    assert.equal(r.status, 200);
    assert.equal(r.body.added, STARTER_LIBRARY.length);
    const again = await api(base, 'POST', '/api/library/starter', { token: admin });
    assert.equal(again.body.added, 0);

    const pending = await list(admin, '?status=PENDING&limit=200');
    assert.equal(pending.body.total, STARTER_LIBRARY.length);
    assert.equal(pending.body.pendingCount, STARTER_LIBRARY.length);
    // Ырастала элек суроолор мугалимге көрүнбөйт
    assert.equal((await list(t1)).body.total, 0);
  });

  it('ырастоо жана четке кагуу', async () => {
    const pending = (await list(admin, '?status=PENDING&limit=200')).body.items;
    const approveIds = pending.slice(0, 10).map((x: any) => x.id);
    const rejectIds = pending.slice(10, 12).map((x: any) => x.id);
    assert.equal((await api(base, 'POST', '/api/library/approve', { token: t1, body: { ids: approveIds } })).status, 403);
    assert.equal((await api(base, 'POST', '/api/library/approve', { token: admin, body: { ids: approveIds } })).body.approved, 10);
    assert.equal((await api(base, 'POST', '/api/library/reject', { token: admin, body: { ids: rejectIds } })).body.rejected, 2);
    // Ырасталганды «четке кагуу» менен өчүрүүгө болбойт
    assert.equal((await api(base, 'POST', '/api/library/reject', { token: admin, body: { ids: approveIds } })).body.rejected, 0);

    const forTeacher = await list(t1);
    assert.equal(forTeacher.body.total, 10);
    assert.equal(forTeacher.body.pendingCount, 0, 'мугалимге модерациянын саны көрсөтүлбөйт');
    assert.equal((await list(admin, '?status=PENDING&limit=200')).body.total, STARTER_LIBRARY.length - 12);
  });
});

describe('мугалимдин бөлүшүүсү жана көчүрүү', () => {
  let sharedId: number;

  it('мугалим өз суроосун бөлүшөт — модерацияга түшөт; бөтөн суроону бөлүшө албайт', async () => {
    const own = await api(base, 'POST', '/api/questions', { token: t1, body: { ...choiceQuestion('ROUND1', 'Мугалимдин уникалдуу суроосу', 'C'), category: 'Тест' } });
    const foreign = await api(base, 'POST', '/api/questions', { token: t2, body: choiceQuestion('ROUND1', 'Бөтөн мугалимдин суроосу') });
    const r = await api(base, 'POST', '/api/library/share', { token: t1, body: { questionIds: [own.body.question.id, foreign.body.question.id] } });
    assert.equal(r.status, 200);
    assert.equal(r.body.shared, 1);
    assert.equal(r.body.pending, true);
    // Кайра бөлүшсө — кайталанбайт
    assert.equal((await api(base, 'POST', '/api/library/share', { token: t1, body: { questionIds: [own.body.question.id] } })).body.shared, 0);

    const mine = await list(t1, '?mine=1');
    assert.equal(mine.body.total, 1);
    assert.equal(mine.body.items[0].status, 'PENDING');
    sharedId = mine.body.items[0].id;
    // Башка мугалим аны көрбөйт
    assert.ok(!(await list(t2, '?limit=200')).body.items.some((x: any) => x.id === sharedId));
  });

  it('ырастала элек суроону көчүрүүгө болбойт', async () => {
    const r = await api(base, 'POST', '/api/library/copy', { token: t2, body: { ids: [sharedId] } });
    assert.equal(r.body.copied, 0);
  });

  it('башка мугалим бөтөн PENDING суроону өчүрө албайт, автор өзү кайра ала алат', async () => {
    assert.equal((await api(base, 'DELETE', `/api/library/${sharedId}`, { token: t2 })).status, 403);
    // Ырастагандан кийин автор өчүрө албайт
    await api(base, 'POST', '/api/library/approve', { token: admin, body: { ids: [sharedId] } });
    assert.equal((await api(base, 'DELETE', `/api/library/${sharedId}`, { token: t1 })).status, 403);
    const shown = await list(t2, '?q=уникалдуу');
    assert.equal(shown.body.total, 1);
    assert.equal(shown.body.items[0].authorName, 'lib1');
  });

  it('көчүрүү: AUTO режиминде кыйынчылыкка жараша турга түшөт, экинчи жолу кайталанбайт', async () => {
    const approved = (await list(t2, '?limit=200')).body.items;
    const pick = (d: string) => approved.find((x: any) => x.difficulty === d);
    const ids = ['EASY', 'MEDIUM', 'HARD'].map((d) => pick(d)?.id).filter(Boolean);
    assert.ok(ids.length >= 2, 'ар кандай кыйынчылыктагы суроолор керек');

    const r = await api(base, 'POST', '/api/library/copy', { token: t2, body: { ids, round: 'AUTO' } });
    assert.equal(r.body.copied, ids.length);
    const bank = (await api(base, 'GET', '/api/questions', { token: t2 })).body.questions.filter((q: any) => q.libraryId);
    assert.equal(bank.length, ids.length);
    for (const q of bank) {
      const src = approved.find((x: any) => x.id === q.libraryId);
      assert.equal(q.round, { EASY: 'ROUND1', MEDIUM: 'ROUND2', HARD: 'FINAL' }[src.difficulty as string]);
      assert.equal(q.text, src.text);
      assert.equal(q.correct, src.correct);
    }

    const again = await api(base, 'POST', '/api/library/copy', { token: t2, body: { ids } });
    assert.equal(again.body.copied, 0);
    assert.equal(again.body.skipped, ids.length);

    const after = await list(t2, '?limit=200');
    assert.deepEqual([...after.body.inBank].sort(), [...ids].sort());
    assert.equal(after.body.items.find((x: any) => x.id === ids[0]).copiedCount, 1);
  });

  it('көчүрүү: тандалган турга; көчүрүлгөн суроону оңдоо китепканага таасир этпейт', async () => {
    const approved = (await list(t1, '?limit=200')).body.items;
    const id = approved[0].id;
    const r = await api(base, 'POST', '/api/library/copy', { token: t1, body: { ids: [id], round: 'FINAL' } });
    assert.equal(r.body.copied, 1);
    assert.equal(r.body.counts.FINAL, 1);
    const q = (await api(base, 'GET', '/api/questions', { token: t1 })).body.questions.find((x: any) => x.libraryId === id);
    assert.equal(q.round, 'FINAL');
    const edit = await api(base, 'PUT', `/api/questions/${q.id}`, { token: t1, body: { ...q, text: 'Өзгөртүлгөн текст' } });
    assert.equal(edit.status, 200);
    assert.equal((await list(t1, '?limit=200')).body.items.find((x: any) => x.id === id).text, approved[0].text);
    // Китепканадан алынган суроо кайра китепканага бөлүшүлбөйт
    assert.equal((await api(base, 'POST', '/api/library/share', { token: t1, body: { questionIds: [q.id] } })).body.shared, 0);
  });

  it('чыпкалар: тема, кыйынчылык, издөө', async () => {
    const all = (await list(t1, '?limit=200')).body;
    const cat = all.categories[0];
    const byCat = await list(t1, `?category=${encodeURIComponent(cat.name)}&limit=200`);
    assert.equal(byCat.body.total, cat.count);
    assert.ok(byCat.body.items.every((x: any) => x.category === cat.name));
    const easy = await list(t1, '?difficulty=EASY&limit=200');
    assert.ok(easy.body.items.every((x: any) => x.difficulty === 'EASY'));
    assert.equal((await list(t1, '?difficulty=WRONG')).status, 400);
  });
});

describe('башкы алып баруучунун башкаруусу', () => {
  it('түз кошуу (дароо ырасталат), кайталанган текст — DUPLICATE_QUESTION, мугалимге 403', async () => {
    const body = { type: 'TF', category: 'Тест', difficulty: 'EASY', text: 'Админдин  жаңы   суроосу', correct: 'A' };
    const r = await api(base, 'POST', '/api/library', { token: admin, body });
    assert.equal(r.status, 201);
    assert.equal(r.body.item.status, 'APPROVED');
    assert.equal(r.body.item.optionA, 'Туура');
    const dup = await api(base, 'POST', '/api/library', { token: admin, body: { ...body, text: 'админдин жаңы суроосу' } });
    assert.equal(dup.body.error, 'DUPLICATE_QUESTION');
    assert.equal((await api(base, 'POST', '/api/library', { token: t1, body: { ...body, text: 'башка' } })).status, 403);
  });

  it('оңдоо: туура эмес суроо кабыл алынбайт', async () => {
    const item = (await list(admin, '?q=Админдин')).body.items[0];
    const ok = await api(base, 'PUT', `/api/library/${item.id}`, { token: admin, body: { ...item, difficulty: 'HARD' } });
    assert.equal(ok.body.item.difficulty, 'HARD');
    const bad = await api(base, 'PUT', `/api/library/${item.id}`, { token: admin, body: { ...item, type: 'CHOICE', correct: 'Z' } });
    assert.equal(bad.status, 400);
    assert.equal((await api(base, 'PUT', '/api/library/999999', { token: admin, body: { ...item } })).status, 404);
  });

  it('Excel импорт: «Тур» мамычасы бош болсо да болот, ката саптар айтылат, кайталангандар өткөрүлөт', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Суроолор');
    ws.addRow(['Тур', 'Түрү', 'Тема', 'Кыйынчылык', 'Суроо', 'А', 'Б', 'В', 'Г', 'Туура жооп', 'Сүрөт']);
    ws.addRow(['', 'Тандоо', 'Импорт', 'Жеңил', 'Импорттолгон суроо 1', '1', '2', '3', '4', 'Б', '']);
    ws.addRow(['Финал', 'Туура / Туура эмес', 'Импорт', 'Кыйын', 'Импорттолгон суроо 2', '', '', '', '', 'Туура эмес', '']);
    ws.addRow(['', 'Тандоо', 'Импорт', 'Орто', 'Варианты жетишсиз суроо', '1', '', '', '', 'А', '']);
    ws.addRow(['', 'Тандоо', 'Импорт', 'Орто', 'Админдин жаңы суроосу', '1', '2', '3', '4', 'А', '']);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const form = new FormData();
    form.append('file', new Blob([buf]), 'library.xlsx');
    const res = await fetch(`${base}/api/library/import`, { method: 'POST', headers: { authorization: `Bearer ${admin}` }, body: form });
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.imported, 2);
    assert.equal(body.duplicates, 1);
    assert.deepEqual(body.errors, [{ row: 4, problem: 'OPTIONS' }]);

    const imported = (await list(t1, '?category=Импорт')).body.items;
    assert.equal(imported.length, 2);
    assert.equal(imported.find((x: any) => x.type === 'TF').correct, 'B');
  });
});
