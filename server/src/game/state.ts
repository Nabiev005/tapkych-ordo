import { prisma } from '../db.js';
import { BUZZ_CHOICE, ROUNDS, type Round } from '../types.js';
import { presence } from './presence.js';
import { currentQuestion, currentRound, isBuzzer, participants, questionMs, playedRound, roundIndex, roundQuestions, type FullGame, type FullQuestion } from './load.js';
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
    // Учурдагы суроонун убактысы (суроого өзүнчө коюлган болушу мүмкүн)
    timerSeconds: questionMs(game, currentQuestion(game)) / 1000,
    teamMode: game.teamMode,
    fiftyFifty: game.fiftyFifty,
    speedBonus: game.speedBonus,
    round,
    index: game.currentIndex,
    total: round ? roundQuestions(game, round).length : 0,
    endsAt: game.questionEndsAt?.getTime() ?? null,
    pausedRemainingMs: game.pausedRemainingMs,
    finishedAt: game.finishedAt?.getTime() ?? null,
    startedAt: game.startedAt?.getTime() ?? null,
    // Оюн башталганда экранда көрсөтүлүүчү интро (видео жок болсо — анимация)
    intro: game.introEnabled ? { videoUrl: game.introVideoUrl } : null,
    // Финалдын «биринчи баскан жооп берет» режими (учурдагы турда)
    buzzer: isBuzzer(game, round),
    mode: game.mode,
  };
}

/**
 * Финалда ким биринчи басканы: жооп берген тартибинде (аты жана убактысы).
 * Кадимки режимде туура/ката бул жерде жок — ал REVEAL'дан кийин гана players[].correct аркылуу көрүнөт.
 * «Биринчи баскан» режиминде status бар: алып баруучу оозеки жоопту баалагандан кийин баары көрөт
 * (туура жооптун өзү ачылбайт — туура бааланса, суроо ошол замат REVEAL'га өтөт).
 */
function pressOrder(game: FullGame, q: FullQuestion | null) {
  const round = currentRound(game);
  if ((round !== 'FINAL' && !isBuzzer(game, round)) || !q || (game.phase !== 'QUESTION' && game.phase !== 'REVEAL')) return null;
  return [...q.answers]
    .sort((a, b) => a.responseMs - b.responseMs || a.id - b.id)
    .map((a) => ({
      playerId: a.playerId,
      name: game.players.find((p) => p.id === a.playerId)?.name ?? '?',
      team: game.players.find((p) => p.id === a.playerId)?.team || '',
      responseMs: a.responseMs,
      ...(a.choice === BUZZ_CHOICE ? { status: !a.judgedAt ? ('pending' as const) : a.isCorrect ? ('correct' as const) : ('wrong' as const) } : {}),
    }));
}

const options = (q: FullQuestion) => ({ A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD });

/** Ар бир вариантты канча оюнчу тандаганы (ORDER түрүндө — туура/ката гана) */
function optionStats(q: FullQuestion) {
  if (q.type === 'ORDER' || q.type === 'OPEN' || q.answers.some((a) => a.choice === BUZZ_CHOICE)) return null;
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
/**
 * Ачык жоопто «варианттар» — бул туура жооптун өзү (жана башка жазылыштары),
 * ошондуктан алар REVEAL'га чейин бош жөнөтүлөт. Алып баруучу дайыма көрөт (revealed = true).
 */
function questionInfo(q: FullQuestion, showText: boolean, revealed: boolean) {
  return {
    number: q.order + 1,
    type: q.type,
    category: q.category,
    text: showText ? q.text : null,
    imageUrl: showText ? q.imageUrl : null,
    audioUrl: showText ? q.audioUrl : null,
    videoUrl: showText ? q.videoUrl : null,
    options: showText ? (q.type === 'OPEN' && !revealed ? { A: '', B: '', C: '', D: '' } : options(q)) : null,
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
  // Оюн учурунда суроо кошуу үчүн: банкта ушул оюнга али алына элек суроолор
  const categories = game.categories
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  const spare = round
    ? await prisma.question.count({
        where: {
          ownerId: game.ownerId,
          archived: false,
          id: { notIn: game.questions.map((x) => x.questionId).filter((id): id is number => id !== null) },
          ...(categories.length ? { category: { in: categories } } : {}),
        },
      })
    : 0;

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
        introEnabled: game.introEnabled,
        introVideoUrl: game.introVideoUrl,
        finalBuzzer: game.finalBuzzer,
        shuffle: game.shuffle,
        mode: game.mode,
      },
    },
    bank,
    bankTotal,
    spare,
    pressOrder: pressOrder(game, q),
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
      avatar: p.avatar,
    })),
    activeIds: active,
    question: q
      ? {
          id: q.id,
          ...questionInfo(q, true, true),
          timerSeconds: q.timerSeconds,
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
                x.type === 'OPEN'
                  ? x.optionA
                  : x.type === 'ORDER'
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
        avatar: p.avatar,
        online: presence.isOnline(p.id),
        answered: !!a,
        // ✓/✗ туура жооп ачылгандан кийин гана
        // «Биринчи баскан» режиминде баспаган оюнчу ката кетирген жок — нейтралдуу (null)
        correct: revealed && q ? (a ? a.isCorrect : isBuzzer(game, round) ? null : false) : null,
        bonus: revealed && a ? a.bonus : 0,
        // Ачык жоопто — оюнчунун жазганы, туура жооп ачылгандан кийин гана
        text: revealed && q?.type === 'OPEN' && a ? a.choice : null,
      };
    }),
    question:
      q && (showText || game.phase === 'READY')
        ? {
            ...questionInfo(q, showText, revealed),
            correct: revealed ? q.correct : null,
            stats: revealed ? optionStats(q) : null,
            // Залдын добушу — туура жооп ачылгандан кийин гана көрсөтүлөт
            audience: revealed ? audienceStats(q) : { total: q.votes.length, counts: null },
          }
        : null,
    pressOrder: pressOrder(game, q),
    leaderboard: showBoard ? rankRound(game, round!) : null,
    teams: game.teamMode && (showBoard || game.status === 'FINISHED' || (game.mode === 'BRAIN_RING' && game.status !== 'LOBBY')) ? teamStandings(game) : null,
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
  const standings = game.status === 'FINISHED' ? overallStandings(game) : [];
  const standing = standings.find((s) => s.playerId === playerId);
  const teams = game.teamMode && game.status === 'FINISHED' ? teamStandings(game) : [];
  const team = me ? teams.find((t) => t.team === (me.team || '—')) : undefined;
  const presses = pressOrder(game, q);
  const myPressIdx = presses ? presses.findIndex((x) => x.playerId === playerId) : -1;

  return {
    role: 'player' as const,
    serverNow: Date.now(),
    game: base(game),
    me: me ? { id: me.id, name: me.name, status: me.status, eliminatedAfter: me.eliminatedAfter, team: me.team, avatar: me.avatar } : null,
    inRound,
    // «50/50» бир оюнда бир жолу (тандоо түрүндөгү суроолордо гана)
    fiftyAvailable: !!me && game.fiftyFifty && !me.fiftyQuestionId,
    // Суроонун тексти жана варианттары суроо көрсөтүлгөндөн кийин гана (экран менен бир убакта) жөнөтүлөт.
    // Туура жооп — REVEAL фазасына чейин эч качан.
    question: q
      ? {
          ...questionInfo(q, showText, revealed),
          hidden: me?.fiftyQuestionId === q.id && me.fiftyHidden ? [...me.fiftyHidden] : [],
          myChoice: myAnswer?.choice ?? null,
          correct: revealed ? q.correct : null,
          myCorrect: revealed ? (myAnswer ? myAnswer.isCorrect : isBuzzer(game, round) ? null : false) : null,
          myPoints: revealed ? (myAnswer?.points ?? 0) : null,
          myBonus: revealed ? (myAnswer?.bonus ?? 0) : null,
        }
      : null,
    // Финалда: мен канчанчы болуп бастым (жана «биринчи баскан» режиминде — баалоонун абалы)
    // Брейн-ринг: командалашы бул суроодо басып койгон (оюнчу кайра баса албайт)
    teamPressed:
      game.mode === 'BRAIN_RING' && !!me && !!q && myPressIdx < 0 && q.answers.some((a) => (game.players.find((p) => p.id === a.playerId)?.team || '—') === (me.team || '—')),
    myPress:
      myPressIdx >= 0
        ? {
            place: myPressIdx + 1,
            status: presses![myPressIdx].status ?? null,
            // Кезекте канчанчы (1 — азыр жооп берип жатат)
            queue: presses![myPressIdx].status === 'pending' ? presses!.filter((x) => x.status === 'pending').findIndex((x) => x.playerId === playerId) + 1 : null,
          }
        : null,
    roundScore: mine?.score ?? 0,
    roundRank: mine?.rank ?? null,
    roundPlayers: ranking.length,
    final: standing ? { place: standing.place, total: standing.total, rounds: standing.rounds } : null,
    teamFinal: team ? { team: team.team, place: team.place, total: team.total } : null,
    // Оюн бүткөндө — жеңүүчүлөр (бөлүшүү карточкасы үчүн; аттар экранда да көрүнөт)
    podium: standings.slice(0, 3).map((s) => ({ name: s.name, total: s.total })),
    players: standings.length,
    championTeam: teams[0] ? { team: teams[0].team, total: teams[0].total } : null,
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
          ...questionInfo(q, showText, revealed),
          myVote: q.votes.find((v) => v.voterId === voterId)?.choice ?? null,
          correct: revealed ? q.correct : null,
          audience: revealed ? audienceStats(q) : null,
        }
      : null,
  };
}
