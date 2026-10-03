import { prisma } from '../db.js';
import { ROUNDS, type Round } from '../types.js';
import { presence } from './presence.js';
import { currentQuestion, currentRound, participants, playedRound, roundQuestions, type FullGame, type FullQuestion } from './load.js';
import { advanceSuggestion, overallStandings, rankRound } from './scoring.js';

/**
 * Ар бир ролго (алып баруучу / жалпы экран / оюнчу) өзүнө тиешелүү гана абалды курат.
 * МААНИЛҮҮ: туура жооп оюнчуга жана экранга REVEAL фазасына чейин эч качан жөнөтүлбөйт.
 */

function base(game: FullGame) {
  const round = currentRound(game);
  return {
    id: game.id,
    code: game.code,
    status: game.status,
    phase: game.phase,
    paused: game.paused,
    showLeaderboard: game.showLeaderboard,
    soundEnabled: game.soundEnabled,
    timerSeconds: game.timerSeconds,
    round,
    index: game.currentIndex,
    total: round ? roundQuestions(game, round).length : 0,
    endsAt: game.questionEndsAt?.getTime() ?? null,
    pausedRemainingMs: game.pausedRemainingMs,
  };
}

const options = (q: FullQuestion) => ({ A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD });

function optionStats(q: FullQuestion) {
  const stats = { A: 0, B: 0, C: 0, D: 0 } as Record<string, number>;
  for (const a of q.answers) stats[a.choice] = (stats[a.choice] ?? 0) + 1;
  return stats;
}

/** Акыркы бүткөн тур (кийинки турдун башында өткөндөрдү көрсөтүү үчүн) */
function previousRound(round: Round | null): Round | null {
  if (round === 'ROUND2') return 'ROUND1';
  if (round === 'FINAL') return 'ROUND2';
  return null;
}

export async function adminSnapshot(game: FullGame) {
  const round = currentRound(game);
  const q = currentQuestion(game);
  const bankGroups = await prisma.question.groupBy({ by: ['round'], _count: { _all: true } });
  const bank = Object.fromEntries(ROUNDS.map((r) => [r, bankGroups.find((g) => g.round === r)?._count._all ?? 0]));
  const active = round ? participants(game, round).filter((p) => p.status === 'ACTIVE').map((p) => p.id) : [];

  return {
    role: 'admin' as const,
    serverNow: Date.now(),
    game: {
      ...base(game),
      settings: {
        pointsPerCorrect: game.pointsPerCorrect,
        timerSeconds: game.timerSeconds,
        round1Count: game.round1Count,
        round2Count: game.round2Count,
        finalQuestionCount: game.finalQuestionCount,
        advanceToRound2: game.advanceToRound2,
        advanceToFinal: game.advanceToFinal,
        expectedPlayers: game.expectedPlayers,
        soundEnabled: game.soundEnabled,
      },
    },
    bank,
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      pin: p.pin,
      status: p.status,
      eliminatedAfter: p.eliminatedAfter,
      joined: p.joinedAt !== null,
      online: presence.isOnline(p.id),
    })),
    activeIds: active,
    question: q
      ? {
          id: q.id,
          number: q.order + 1,
          text: q.text,
          imageUrl: q.imageUrl,
          options: options(q),
          correct: q.correct,
          startedAt: q.startedAt?.getTime() ?? null,
          revealed: !!q.revealedAt,
          stats: optionStats(q),
        }
      : null,
    // Алып баруучу жоопторду ошол замат көрөт: ким туура (жашыл), ким ката (кызыл)
    answers: q
      ? Object.fromEntries(q.answers.map((a) => [a.playerId, { choice: a.choice, isCorrect: a.isCorrect, responseMs: a.responseMs }]))
      : {},
    leaderboard: round ? rankRound(game, round) : [],
    roundEnd: round && game.phase === 'ROUND_END' ? advanceSuggestion(game, round) : null,
    standings: game.status === 'LOBBY' ? [] : overallStandings(game),
  };
}

export function screenSnapshot(game: FullGame) {
  const round = currentRound(game);
  const q = currentQuestion(game);
  const revealed = !!q?.revealedAt;
  const showText = game.phase === 'QUESTION' || game.phase === 'REVEAL';

  const shownPlayers =
    game.status === 'LOBBY'
      ? game.players.filter((p) => p.joinedAt !== null && p.status !== 'KICKED')
      : round
        ? participants(game, round).filter((p) => p.status === 'ACTIVE')
        : [];

  const prev = previousRound(round);
  return {
    role: 'screen' as const,
    serverNow: Date.now(),
    game: base(game),
    players: shownPlayers.map((p) => {
      const a = q?.answers.find((x) => x.playerId === p.id);
      return {
        id: p.id,
        name: p.name,
        online: presence.isOnline(p.id),
        answered: !!a,
        // ✓/✗ туура жооп ачылгандан кийин гана
        correct: revealed && q ? (a ? a.isCorrect : false) : null,
      };
    }),
    question:
      q && (showText || game.phase === 'READY')
        ? {
            number: q.order + 1,
            text: showText ? q.text : null,
            imageUrl: showText ? q.imageUrl : null,
            options: showText ? options(q) : null,
            correct: revealed ? q.correct : null,
            stats: revealed ? optionStats(q) : null,
          }
        : null,
    leaderboard:
      round && (game.showLeaderboard || game.phase === 'ROUND_END') ? rankRound(game, round) : null,
    // Жаңы турдун башында: мурунку турдан өткөндөр салтанаттуу көрсөтүлөт
    qualifiers:
      round && prev && game.phase === 'IDLE'
        ? participants(game, round)
            .filter((p) => p.status === 'ACTIVE')
            .map((p) => ({ id: p.id, name: p.name }))
        : null,
    standings: game.status === 'FINISHED' ? overallStandings(game) : null,
    finalRanking: game.status === 'FINISHED' ? rankRound(game, 'FINAL') : null,
  };
}

export function playerSnapshot(game: FullGame, playerId: number) {
  const me = game.players.find((p) => p.id === playerId);
  const round = currentRound(game);
  const q = currentQuestion(game);
  const revealed = !!q?.revealedAt;
  const myAnswer = q?.answers.find((a) => a.playerId === playerId);
  const inRound = !!me && !!round && me.status === 'ACTIVE' && playedRound(me, round);
  const ranking = round && inRound ? rankRound(game, round) : [];
  const mine = ranking.find((r) => r.playerId === playerId);
  const standing = game.status === 'FINISHED' ? overallStandings(game).find((s) => s.playerId === playerId) : undefined;

  return {
    role: 'player' as const,
    serverNow: Date.now(),
    game: base(game),
    me: me ? { id: me.id, name: me.name, status: me.status, eliminatedAfter: me.eliminatedAfter } : null,
    inRound,
    // Суроонун тексти жана варианттары телефонго ЖӨНӨТҮЛБӨЙТ — алар жалпы экранда
    question: q
      ? {
          number: q.order + 1,
          myChoice: myAnswer?.choice ?? null,
          correct: revealed ? q.correct : null,
          myCorrect: revealed ? (myAnswer?.isCorrect ?? false) : null,
          myPoints: revealed ? (myAnswer?.points ?? 0) : null,
        }
      : null,
    roundScore: mine?.score ?? 0,
    roundRank: mine?.rank ?? null,
    roundPlayers: ranking.length,
    final: standing ? { place: standing.place, total: standing.total, rounds: standing.rounds } : null,
  };
}
