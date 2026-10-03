import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { bus } from '../events.js';
import { AppError, OPTIONS, ROUNDS, nextRound, type Option, type Round } from '../types.js';
import { currentQuestion, currentRound, loadFull, participants, roundQuestions, roundSize, type FullGame } from './load.js';

/**
 * Оюндун кыймылдаткычы. Бардык абал БДда сакталат, ошондуктан сервер же
 * алып баруучунун баракчасы жаңыланса да, оюн ошол жерден уланат.
 * Таймер сервердин убактысы боюнча эсептелет.
 */

/** Тармак кечигүүсү үчүн кичинекей жеңилдик (мс) */
const ANSWER_GRACE_MS = 400;

const timers = new Map<number, NodeJS.Timeout>();
const locks = new Map<number, Promise<unknown>>();

/** Бир оюндун аракеттери кезек менен аткарылат (эки жолу басып алуудан коргойт) */
function withLock<T>(gameId: number, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(gameId) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  locks.set(
    gameId,
    run.catch(() => undefined),
  );
  return run;
}

function changed(gameId: number) {
  bus.emit('game:changed', gameId);
}

function clearTimer(gameId: number) {
  const t = timers.get(gameId);
  if (t) clearTimeout(t);
  timers.delete(gameId);
}

function scheduleClose(gameId: number, endsAt: Date) {
  clearTimer(gameId);
  const ms = Math.max(0, endsAt.getTime() - Date.now() + ANSWER_GRACE_MS);
  timers.set(
    gameId,
    setTimeout(() => {
      timers.delete(gameId);
      bus.emit('question:closed', gameId);
      changed(gameId);
    }, ms),
  );
}

async function mustLoad(gameId: number): Promise<FullGame> {
  const game = await loadFull(gameId);
  if (!game) throw new AppError('GAME_NOT_FOUND', 404);
  return game;
}

function mustRound(game: FullGame): Round {
  const round = currentRound(game);
  if (!round) throw new AppError('INVALID_ACTION');
  return round;
}

function notPaused(game: FullGame) {
  if (game.paused) throw new AppError('GAME_PAUSED');
}

// ───────────────────────── Алып баруучунун аракеттери ─────────────────────────

async function startGame(gameId: number) {
  const game = await mustLoad(gameId);
  if (game.status !== 'LOBBY') throw new AppError('INVALID_ACTION');
  const players = game.players.filter((p) => p.status !== 'KICKED');
  if (players.length < 2) throw new AppError('NOT_ENOUGH_PLAYERS');

  const snapshot: Prisma.GameQuestionCreateManyInput[] = [];
  for (const round of ROUNDS) {
    const need = roundSize(game, round);
    const bank = await prisma.question.findMany({ where: { round }, orderBy: { order: 'asc' }, take: need });
    if (bank.length < need) throw new AppError('NOT_ENOUGH_QUESTIONS', 400, { round, need, have: bank.length });
    bank.forEach((q, order) =>
      snapshot.push({
        gameId,
        questionId: q.id,
        round,
        order,
        text: q.text,
        imageUrl: q.imageUrl,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correct: q.correct,
      }),
    );
  }

  await prisma.$transaction([
    prisma.gameQuestion.deleteMany({ where: { gameId } }),
    prisma.gameQuestion.createMany({ data: snapshot }),
    prisma.game.update({
      where: { id: gameId },
      data: { status: 'ROUND1', phase: 'IDLE', currentIndex: -1, startedAt: new Date(), paused: false },
    }),
  ]);
}

async function nextQuestion(gameId: number) {
  const game = await mustLoad(gameId);
  const round = mustRound(game);
  notPaused(game);
  if (game.phase !== 'IDLE' && game.phase !== 'REVEAL') throw new AppError('INVALID_ACTION');
  if (game.currentIndex + 1 >= roundQuestions(game, round).length) throw new AppError('INVALID_ACTION');
  await prisma.game.update({
    where: { id: gameId },
    data: { phase: 'READY', currentIndex: game.currentIndex + 1, showLeaderboard: false, questionEndsAt: null },
  });
}

async function showQuestion(gameId: number) {
  const game = await mustLoad(gameId);
  mustRound(game);
  notPaused(game);
  const q = currentQuestion(game);
  if (game.phase !== 'READY' || !q) throw new AppError('INVALID_ACTION');
  const now = new Date();
  const endsAt = new Date(now.getTime() + game.timerSeconds * 1000);
  await prisma.$transaction([
    prisma.gameQuestion.update({ where: { id: q.id }, data: { startedAt: now, endsAt } }),
    prisma.game.update({
      where: { id: gameId },
      data: { phase: 'QUESTION', questionEndsAt: endsAt, showLeaderboard: false, pausedRemainingMs: null },
    }),
  ]);
  scheduleClose(gameId, endsAt);
}

async function revealAnswer(gameId: number) {
  const game = await mustLoad(gameId);
  mustRound(game);
  const q = currentQuestion(game);
  if (game.phase !== 'QUESTION' || !q) throw new AppError('INVALID_ACTION');
  clearTimer(gameId);
  const now = new Date();
  // Убакыт бүтө электе ачылса — жооп берүү ошол замат жабылат
  const endsAt = game.questionEndsAt && game.questionEndsAt < now ? game.questionEndsAt : now;
  await prisma.$transaction([
    prisma.gameQuestion.update({ where: { id: q.id }, data: { revealedAt: now, endsAt } }),
    prisma.game.update({
      where: { id: gameId },
      data: { phase: 'REVEAL', questionEndsAt: endsAt, paused: false, pausedRemainingMs: null },
    }),
  ]);
}

async function restartQuestion(gameId: number) {
  const game = await mustLoad(gameId);
  mustRound(game);
  const q = currentQuestion(game);
  if ((game.phase !== 'QUESTION' && game.phase !== 'REVEAL') || !q) throw new AppError('INVALID_ACTION');
  clearTimer(gameId);
  await prisma.$transaction([
    prisma.answer.deleteMany({ where: { gameQuestionId: q.id } }),
    prisma.gameQuestion.update({ where: { id: q.id }, data: { startedAt: null, endsAt: null, revealedAt: null } }),
    prisma.game.update({
      where: { id: gameId },
      data: { phase: 'READY', questionEndsAt: null, paused: false, pausedRemainingMs: null },
    }),
  ]);
}

async function toggleLeaderboard(gameId: number) {
  const game = await mustLoad(gameId);
  mustRound(game);
  if (game.phase === 'QUESTION') throw new AppError('INVALID_ACTION');
  await prisma.game.update({ where: { id: gameId }, data: { showLeaderboard: !game.showLeaderboard } });
}

async function endRound(gameId: number) {
  const game = await mustLoad(gameId);
  const round = mustRound(game);
  notPaused(game);
  const total = roundQuestions(game, round).length;
  if (game.phase !== 'REVEAL' || game.currentIndex !== total - 1) throw new AppError('INVALID_ACTION');
  await prisma.game.update({ where: { id: gameId }, data: { phase: 'ROUND_END', showLeaderboard: false } });
}

async function confirmAdvance(gameId: number, playerIds: number[]) {
  const game = await mustLoad(gameId);
  const round = mustRound(game);
  const next = nextRound(round);
  if (game.phase !== 'ROUND_END' || !next) throw new AppError('INVALID_ACTION');
  const current = participants(game, round).filter((p) => p.status === 'ACTIVE');
  const keep = new Set(playerIds.filter((id) => current.some((p) => p.id === id)));
  if (keep.size < 1) throw new AppError('NOT_ENOUGH_PLAYERS');
  const out = current.filter((p) => !keep.has(p.id)).map((p) => p.id);
  await prisma.$transaction([
    prisma.player.updateMany({ where: { id: { in: out } }, data: { status: 'ELIMINATED', eliminatedAfter: round } }),
    prisma.game.update({
      where: { id: gameId },
      data: { status: next, phase: 'IDLE', currentIndex: -1, questionEndsAt: null, showLeaderboard: false },
    }),
  ]);
}

async function finishGame(gameId: number) {
  const game = await mustLoad(gameId);
  if (game.status !== 'FINAL' || game.phase !== 'ROUND_END') throw new AppError('INVALID_ACTION');
  await prisma.game.update({
    where: { id: gameId },
    data: { status: 'FINISHED', phase: 'IDLE', finishedAt: new Date(), showLeaderboard: false },
  });
}

async function togglePause(gameId: number) {
  const game = await mustLoad(gameId);
  if (game.status === 'LOBBY' || game.status === 'FINISHED') throw new AppError('INVALID_ACTION');
  const now = Date.now();
  const running = game.phase === 'QUESTION';

  if (!game.paused) {
    let pausedRemainingMs: number | null = null;
    if (running && game.questionEndsAt && game.questionEndsAt.getTime() > now) {
      pausedRemainingMs = game.questionEndsAt.getTime() - now;
      clearTimer(gameId);
    }
    await prisma.game.update({
      where: { id: gameId },
      data: {
        paused: true,
        pausedRemainingMs,
        ...(pausedRemainingMs !== null ? { questionEndsAt: null } : {}),
      },
    });
    return;
  }

  // Тыныгуудан чыгуу: калган убакыт ушул учурдан кайра эсептелет
  if (running && game.pausedRemainingMs !== null) {
    const endsAt = new Date(now + game.pausedRemainingMs);
    const q = currentQuestion(game);
    await prisma.$transaction([
      ...(q ? [prisma.gameQuestion.update({ where: { id: q.id }, data: { endsAt } })] : []),
      prisma.game.update({
        where: { id: gameId },
        data: { paused: false, pausedRemainingMs: null, questionEndsAt: endsAt },
      }),
    ]);
    scheduleClose(gameId, endsAt);
    return;
  }
  await prisma.game.update({ where: { id: gameId }, data: { paused: false, pausedRemainingMs: null } });
}

async function kickPlayer(gameId: number, playerId: number) {
  const game = await mustLoad(gameId);
  if (!game.players.some((p) => p.id === playerId)) throw new AppError('NOT_FOUND', 404);
  await prisma.player.update({ where: { id: playerId }, data: { status: 'KICKED', token: null } });
  bus.emit('player:session', playerId);
}

async function restorePlayer(gameId: number, playerId: number) {
  const game = await mustLoad(gameId);
  const p = game.players.find((x) => x.id === playerId);
  if (!p || p.status !== 'KICKED') throw new AppError('INVALID_ACTION');
  await prisma.player.update({ where: { id: playerId }, data: { status: p.eliminatedAfter ? 'ELIMINATED' : 'ACTIVE' } });
}

async function adjustScore(gameId: number, playerId: number, delta: number, roundArg?: Round) {
  const game = await mustLoad(gameId);
  const round = roundArg ?? currentRound(game) ?? (game.status === 'FINISHED' ? 'FINAL' : null);
  if (!round) throw new AppError('INVALID_ACTION');
  if (!game.players.some((p) => p.id === playerId)) throw new AppError('NOT_FOUND', 404);
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100) throw new AppError('BAD_REQUEST');
  await prisma.scoreAdjustment.create({ data: { gameId, playerId, round, delta } });
}

async function setSound(gameId: number, enabled: boolean) {
  await prisma.game.update({ where: { id: gameId }, data: { soundEnabled: enabled } });
}

export type AdminAction =
  | { type: 'startGame' }
  | { type: 'nextQuestion' }
  | { type: 'showQuestion' }
  | { type: 'revealAnswer' }
  | { type: 'restartQuestion' }
  | { type: 'toggleLeaderboard' }
  | { type: 'endRound' }
  | { type: 'confirmAdvance'; playerIds: number[] }
  | { type: 'finishGame' }
  | { type: 'togglePause' }
  | { type: 'kickPlayer'; playerId: number }
  | { type: 'restorePlayer'; playerId: number }
  | { type: 'adjustScore'; playerId: number; delta: number; round?: Round }
  | { type: 'setSound'; enabled: boolean };

export function runAdminAction(gameId: number, a: AdminAction): Promise<void> {
  return withLock(gameId, async () => {
    switch (a.type) {
      case 'startGame': await startGame(gameId); break;
      case 'nextQuestion': await nextQuestion(gameId); break;
      case 'showQuestion': await showQuestion(gameId); break;
      case 'revealAnswer': await revealAnswer(gameId); break;
      case 'restartQuestion': await restartQuestion(gameId); break;
      case 'toggleLeaderboard': await toggleLeaderboard(gameId); break;
      case 'endRound': await endRound(gameId); break;
      case 'confirmAdvance': await confirmAdvance(gameId, Array.isArray(a.playerIds) ? a.playerIds.map(Number) : []); break;
      case 'finishGame': await finishGame(gameId); break;
      case 'togglePause': await togglePause(gameId); break;
      case 'kickPlayer': await kickPlayer(gameId, Number(a.playerId)); break;
      case 'restorePlayer': await restorePlayer(gameId, Number(a.playerId)); break;
      case 'adjustScore':
        await adjustScore(gameId, Number(a.playerId), Number(a.delta), ROUNDS.includes(a.round as Round) ? a.round : undefined);
        break;
      case 'setSound': await setSound(gameId, !!a.enabled); break;
      default: throw new AppError('INVALID_ACTION');
    }
    changed(gameId);
  });
}

// ───────────────────────── Оюнчунун жообу ─────────────────────────

export function submitAnswer(gameId: number, playerId: number, choiceRaw: unknown): Promise<void> {
  return withLock(gameId, async () => {
    const choice = String(choiceRaw) as Option;
    if (!OPTIONS.includes(choice)) throw new AppError('BAD_REQUEST');
    const game = await mustLoad(gameId);
    const round = currentRound(game);
    const q = currentQuestion(game);
    const player = game.players.find((p) => p.id === playerId);
    if (!round || !q || !player) throw new AppError('INVALID_ACTION');
    if (player.status !== 'ACTIVE') throw new AppError('NOT_IN_ROUND');
    if (game.phase !== 'QUESTION') throw new AppError('TIME_UP');
    if (game.paused) throw new AppError('GAME_PAUSED');
    const now = Date.now();
    const endsAt = game.questionEndsAt?.getTime();
    if (!endsAt || now > endsAt + ANSWER_GRACE_MS) throw new AppError('TIME_UP');
    if (q.answers.some((a) => a.playerId === playerId)) throw new AppError('ALREADY_ANSWERED');

    const fullMs = game.timerSeconds * 1000;
    const responseMs = Math.min(fullMs, Math.max(0, fullMs - (endsAt - now)));
    const isCorrect = choice === q.correct;
    try {
      await prisma.answer.create({
        data: {
          gameId,
          playerId,
          gameQuestionId: q.id,
          choice,
          isCorrect,
          responseMs,
          points: isCorrect ? game.pointsPerCorrect : 0,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new AppError('ALREADY_ANSWERED');
      throw e;
    }
    changed(gameId);
  });
}

/** Сервер кайра иштетилгенде жүрүп жаткан таймерлерди калыбына келтирет */
export async function restoreTimers() {
  const running = await prisma.game.findMany({ where: { phase: 'QUESTION', paused: false, questionEndsAt: { not: null } } });
  for (const g of running) {
    if (g.questionEndsAt && g.questionEndsAt.getTime() > Date.now()) scheduleClose(g.id, g.questionEndsAt);
  }
}
