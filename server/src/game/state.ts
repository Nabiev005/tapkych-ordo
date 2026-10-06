import { prisma } from '../db.js';
import { ROUNDS, type Round } from '../types.js';
import { presence } from './presence.js';
import { currentQuestion, currentRound, participants, playedRound, roundIndex, roundQuestions, type FullGame, type FullQuestion } from './load.js';
import { advanceSuggestion, overallStandings, rankRound, teamStandings } from './scoring.js';

/**
 * Ар бир ролго (алып баруучу / жалпы экран / оюнчу / көрүүчү) өзүнө тиешелүү гана абалды курат.
 * МААНИЛҮҮ: туура жооп оюнчуга, экранга жана көрүүчүлөргө REVEAL фазасына чейин эч качан жөнөтүлбөйт.
 */

function base(game: FullGame) {
  const round = currentRound(game);
  return {
    id: game.id,
    code: game.code,
    title: game.title,
    status: game.status,
    phase: game.phase,
    paused: game.paused,
    showLeaderboard: game.showLeaderboard,
    soundEnabled: game.soundEnabled,
    timerSeconds: game.timerSeconds,
    teamMode: game.teamMode,
    fiftyFifty: game.fiftyFifty,
    speedBonus: game.speedBonus,
    round,
    index: game.currentIndex,
    total: round ? roundQuestions(game, round).length : 0,
    endsAt: game.questionEndsAt?.getTime() ?? null,
    pausedRemainingMs: game.pausedRemainingMs,
  };
}

const options = (q: FullQuestion) => ({ A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD });

/** Ар бир вариантты канча оюнчу тандаганы (ORDER түрүндө — туура/ката гана) */
function optionStats(q: FullQuestion) {
  if (q.type === 'ORDER') return null;
  const stats = { A: 0, B: 0, C: 0, D: 0 } as Record<string, number>;
  for (const a of q.answers) stats[a.choice] = (stats[a.choice] ?? 0) + 1;
  return stats;
}

/** Залдагы көрүүчүлөрдүн добуштары */
function audienceStats(q: FullQuestion) {
  const counts = { A: 0, B: 0, C: 0, D: 0 } as Record<string, number>;
  for (const v of q.votes) counts[v.choice] = (counts[v.choice] ?? 0) + 1;
  return { total: q.votes.length, counts };
}

/** Суроонун жалпы маалыматы (туура жоопсуз) */
function questionInfo(q: FullQuestion, showText: boolean) {
  return {
    number: q.order + 1,
    type: q.type,
    category: q.category,
    text: showText ? q.text : null,
    imageUrl: showText ? q.imageUrl : null,
    audioUrl: showText ? q.audioUrl : null,
    options: showText ? options(q) : null,
  };
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
  const bankGroups = await prisma.question.groupBy({ by: ['round'], where: { ownerId: game.ownerId, archived: false }, _count: { _all: true } });
  const bank = Object.fromEntries(ROUNDS.map((r) => [r, bankGroups.find((g) => g.round === r)?._count._all ?? 0]));
  const bankTotal = Object.values(bank).reduce((s, n) => s + n, 0);
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
        teamMode: game.teamMode,
        speedBonus: game.speedBonus,
        fiftyFifty: game.fiftyFifty,
        selectionMode: game.selectionMode,
        categories: game.categories,
      },
    },
    bank,
    bankTotal,
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      pin: p.pin,
      team: p.team,
      status: p.status,
      eliminatedAfter: p.eliminatedAfter,
      joined: p.joinedAt !== null,
      online: presence.isOnline(p.id),
      fiftyUsed: !!p.fiftyQuestionId,
    })),
    activeIds: active,
    question: q
      ? {
          id: q.id,
          ...questionInfo(q, true),
          correct: q.correct,
          startedAt: q.startedAt?.getTime() ?? null,
          revealed: !!q.revealedAt,
          stats: optionStats(q),
          audience: audienceStats(q),
        }
      : null,
    // Алып баруучу жоопторду ошол замат көрөт: ким туура (жашыл), ким ката (кызыл)
    answers: q
      ? Object.fromEntries(
          q.answers.map((a) => [a.playerId, { choice: a.choice, isCorrect: a.isCorrect, responseMs: a.responseMs, bonus: a.bonus }]),
        )
      : {},
    leaderboard: round ? rankRound(game, round) : [],
    roundEnd: round && game.phase === 'ROUND_END' ? advanceSuggestion(game, round) : null,
    standings: game.status === 'LOBBY' ? [] : overallStandings(game),
    teams: game.teamMode && game.status !== 'LOBBY' ? teamStandings(game) : [],
    // Оюн бүткөндө — суралган суроолордун тизмеси (тарых үчүн)
    askedQuestions:
      game.status === 'FINISHED'
        ? [...game.questions]
            .sort((a, b) => roundIndex(a.round as Round) - roundIndex(b.round as Round) || a.order - b.order)
            .filter((x) => x.startedAt)
            .map((x) => ({
              id: x.id,
              round: x.round,
              number: x.order + 1,
              type: x.type,
              text: x.text,
              correct: x.correct,
              correctText:
                x.type === 'ORDER'
                  ? [...x.correct].map((l) => options(x)[l as keyof ReturnType<typeof options>]).join(' → ')
                  : options(x)[x.correct as keyof ReturnType<typeof options>],
              answered: x.answers.length,
              correctCount: x.answers.filter((a) => a.isCorrect).length,
            }))
        : [],
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
  const showBoard = !!round && (game.showLeaderboard || game.phase === 'ROUND_END');
  return {
    role: 'screen' as const,
    serverNow: Date.now(),
    game: base(game),
    players: shownPlayers.map((p) => {
      const a = q?.answers.find((x) => x.playerId === p.id);
      return {
        id: p.id,
        name: p.name,
        team: p.team,
        online: presence.isOnline(p.id),
        answered: !!a,
        // ✓/✗ туура жооп ачылгандан кийин гана
        correct: revealed && q ? (a ? a.isCorrect : false) : null,
        bonus: revealed && a ? a.bonus : 0,
      };
    }),
    question:
      q && (showText || game.phase === 'READY')
        ? {
            ...questionInfo(q, showText),
            correct: revealed ? q.correct : null,
            stats: revealed ? optionStats(q) : null,
            // Залдын добушу — туура жооп ачылгандан кийин гана көрсөтүлөт
            audience: revealed ? audienceStats(q) : { total: q.votes.length, counts: null },
          }
        : null,
    leaderboard: showBoard ? rankRound(game, round!) : null,
    teams: game.teamMode && (showBoard || game.status === 'FINISHED') ? teamStandings(game) : null,
    // Жаңы турдун башында: мурунку турдан өткөндөр салтанаттуу көрсөтүлөт
    qualifiers:
      round && prev && game.phase === 'IDLE' && !game.teamMode
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
  const showText = game.phase === 'QUESTION' || game.phase === 'REVEAL';
  const inRound = !!me && !!round && me.status === 'ACTIVE' && playedRound(me, round);
  const ranking = round && inRound ? rankRound(game, round) : [];
  const mine = ranking.find((r) => r.playerId === playerId);
  const standing = game.status === 'FINISHED' ? overallStandings(game).find((s) => s.playerId === playerId) : undefined;
  const team = game.teamMode && game.status === 'FINISHED' && me ? teamStandings(game).find((t) => t.team === (me.team || '—')) : undefined;

  return {
    role: 'player' as const,
    serverNow: Date.now(),
    game: base(game),
    me: me ? { id: me.id, name: me.name, status: me.status, eliminatedAfter: me.eliminatedAfter, team: me.team } : null,
    inRound,
    // «50/50» бир оюнда бир жолу (тандоо түрүндөгү суроолордо гана)
    fiftyAvailable: !!me && game.fiftyFifty && !me.fiftyQuestionId,
    // Суроонун тексти жана варианттары суроо көрсөтүлгөндөн кийин гана (экран менен бир убакта) жөнөтүлөт.
    // Туура жооп — REVEAL фазасына чейин эч качан.
    question: q
      ? {
          ...questionInfo(q, showText),
          hidden: me?.fiftyQuestionId === q.id && me.fiftyHidden ? [...me.fiftyHidden] : [],
          myChoice: myAnswer?.choice ?? null,
          correct: revealed ? q.correct : null,
          myCorrect: revealed ? (myAnswer?.isCorrect ?? false) : null,
          myPoints: revealed ? (myAnswer?.points ?? 0) : null,
          myBonus: revealed ? (myAnswer?.bonus ?? 0) : null,
        }
      : null,
    roundScore: mine?.score ?? 0,
    roundRank: mine?.rank ?? null,
    roundPlayers: ranking.length,
    final: standing ? { place: standing.place, total: standing.total, rounds: standing.rounds } : null,
    teamFinal: team ? { team: team.team, place: team.place, total: team.total } : null,
  };
}

/** Залдагы көрүүчү (PIN’сиз): суроо, варианттар жана өзүнүн добушу */
export function audienceSnapshot(game: FullGame, voterId: string) {
  const q = currentQuestion(game);
  const revealed = !!q?.revealedAt;
  const showText = game.phase === 'QUESTION' || game.phase === 'REVEAL';
  return {
    role: 'audience' as const,
    serverNow: Date.now(),
    game: base(game),
    question: q
      ? {
          ...questionInfo(q, showText),
          myVote: q.votes.find((v) => v.voterId === voterId)?.choice ?? null,
          correct: revealed ? q.correct : null,
          audience: revealed ? audienceStats(q) : null,
        }
      : null,
  };
}
