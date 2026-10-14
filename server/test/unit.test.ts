/** Таза функциялар: упай/орун эсептөө, жооптун форматы, суроонун текшерилиши, PIN бөгөтү */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rankScores, type RoundScore } from '../src/game/scoring.js';
import { validChoice } from '../src/game/engine.js';
import { questionSchema } from '../src/routes/questions.js';
import { FailLimiter } from '../src/rateLimit.js';
import { AppError } from '../src/types.js';

const s = (playerId: number, score: number, timeMs: number): RoundScore => ({ playerId, name: `P${playerId}`, score, timeMs, correct: 0 });

describe('rankScores', () => {
  it('көп упай жогору турат', () => {
    const r = rankScores([s(1, 10, 5000), s(2, 30, 9000), s(3, 20, 1000)]);
    assert.deepEqual(
      r.map((x) => [x.playerId, x.rank]),
      [
        [2, 1],
        [3, 2],
        [1, 3],
      ],
    );
  });

  it('упай тең болсо, аз убакыт короткон жогору', () => {
    const r = rankScores([s(1, 20, 8000), s(2, 20, 3000)]);
    assert.equal(r[0].playerId, 2);
    assert.equal(r[0].rank, 1);
    assert.equal(r[1].rank, 2);
    assert.equal(r[0].tied, false);
  });

  it('упай да, убакыт да так бирдей болсо — бир орунду бөлүшөт', () => {
    const r = rankScores([s(1, 30, 1000), s(2, 20, 5000), s(3, 20, 5000), s(4, 10, 0)]);
    assert.deepEqual(
      r.map((x) => x.rank),
      [1, 2, 2, 4],
    );
    assert.deepEqual(
      r.map((x) => x.tied),
      [false, true, true, false],
    );
  });

  it('баштапкы массивди өзгөртпөйт', () => {
    const input = [s(1, 1, 0), s(2, 2, 0)];
    rankScores(input);
    assert.deepEqual(
      input.map((x) => x.playerId),
      [1, 2],
    );
  });
});

describe('validChoice', () => {
  it('CHOICE: A–D гана', () => {
    for (const c of ['A', 'B', 'C', 'D']) assert.ok(validChoice('CHOICE', c));
    for (const c of ['', 'E', 'AB', 'a']) assert.ok(!validChoice('CHOICE', c));
  });

  it('TF: A же B гана', () => {
    assert.ok(validChoice('TF', 'A'));
    assert.ok(validChoice('TF', 'B'));
    assert.ok(!validChoice('TF', 'C'));
  });

  it('ORDER: ABCD тамгаларынын ар бири бир жолудан', () => {
    assert.ok(validChoice('ORDER', 'DCBA'));
    assert.ok(validChoice('ORDER', 'BADC'));
    assert.ok(!validChoice('ORDER', 'AABC'));
    assert.ok(!validChoice('ORDER', 'ABC'));
    assert.ok(!validChoice('ORDER', 'ABCDE'));
  });
});

describe('questionSchema', () => {
  const base = { round: 'ROUND1', text: 'Суроо?', optionA: '1', optionB: '2', optionC: '3', optionD: '4' };

  it('CHOICE: туура суроо кабыл алынат, тамга чоңойтулат', () => {
    const q = questionSchema.parse({ ...base, correct: 'c' });
    assert.equal(q.correct, 'C');
    assert.equal(q.type, 'CHOICE');
    assert.equal(q.difficulty, 'MEDIUM');
  });

  it('CHOICE: бош вариант болсо — ката', () => {
    assert.throws(() => questionSchema.parse({ ...base, optionD: '', correct: 'A' }));
  });

  it('CHOICE: туура жооп A–D эмес болсо — ката', () => {
    assert.throws(() => questionSchema.parse({ ...base, correct: 'E' }));
  });

  it('TF: варианттар автоматтык коюлат, C/D — ката', () => {
    const q = questionSchema.parse({ round: 'FINAL', type: 'TF', text: 'Туурабы?', correct: 'b' });
    assert.equal(q.optionA, 'Туура');
    assert.equal(q.optionB, 'Туура эмес');
    assert.equal(q.optionC, '');
    assert.equal(q.correct, 'B');
    assert.throws(() => questionSchema.parse({ round: 'FINAL', type: 'TF', text: 'Туурабы?', correct: 'C' }));
  });

  it('ORDER: туура тартип талап кылынат', () => {
    assert.equal(questionSchema.parse({ ...base, type: 'ORDER', correct: 'dbca' }).correct, 'DBCA');
    assert.throws(() => questionSchema.parse({ ...base, type: 'ORDER', correct: 'AABB' }));
  });

  it('бош текст — ката', () => {
    assert.throws(() => questionSchema.parse({ ...base, text: '   ', correct: 'A' }));
  });
});

describe('FailLimiter', () => {
  it('чектен ашканда TOO_MANY_ATTEMPTS, reset кийин кайра уруксат', () => {
    const lim = new FailLimiter(3, 60_000);
    for (let i = 0; i < 3; i++) {
      lim.check('ip');
      lim.fail('ip');
    }
    assert.throws(
      () => lim.check('ip'),
      (e) => e instanceof AppError && e.code === 'TOO_MANY_ATTEMPTS' && e.status === 429,
    );
    // Башка ачкыч таасир албайт
    lim.check('other');
    lim.reset('ip');
    lim.check('ip');
  });

  it('убакыт терезеси өткөн аракеттер эсептелбейт', async () => {
    const lim = new FailLimiter(1, 30);
    lim.fail('k');
    assert.throws(() => lim.check('k'));
    await new Promise((r) => setTimeout(r, 50));
    lim.check('k');
  });
});
