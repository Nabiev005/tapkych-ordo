import { ROUNDS, type Round } from '../types.js';
import { type FullGame, participants, playedRound, roundIndex, roundQuestions } from './load.js';

export interface RoundScore {
  playerId: number;
  name: string;
  score: number;
  /** Жоопторго короткон жалпы убакыт (мс). Жооп бербесе — суроонун толук убактысы эсептелет. */
  timeMs: number;
  correct: number;
}

export interface Ranked extends RoundScore {
  rank: number;
  /** Упайы да, убактысы да башка оюнчу менен так бирдей */
  tied: boolean;
}

/**
 * Турдун упайлары. МААНИЛҮҮ: ачыла элек (revealedAt жок) суроолор эсептелбейт —
 * ошондуктан рейтинг туура жоопту мөөнөтүнөн мурун ачыкка чыгарбайт.
 */
export function roundScores(game: FullGame, round: Round): RoundScore[] {
  const questions = roundQuestions(game, round).filter((q) => q.revealedAt);
  const fullMs = game.timerSeconds * 1000;
  return participants(game, round).map((p) => {
    let score = 0;
    let timeMs = 0;
    let correct = 0;
    for (const q of questions) {
      const a = q.answers.find((x) => x.playerId === p.id);
      if (a) {
        score += a.points;
        timeMs += a.responseMs;
        if (a.isCorrect) correct++;
      } else {
        timeMs += fullMs;
      }
    }
    for (const adj of game.adjustments) {
      if (adj.playerId === p.id && adj.round === round) score += adj.delta;
    }
    return { playerId: p.id, name: p.name, score, timeMs, correct };
  });
}

/** Эреже: көп упай жогору; упай тең болсо — аз убакыт короткон жогору */
export function compareScores(a: RoundScore, b: RoundScore): number {
  return b.score - a.score || a.timeMs - b.timeMs;
}

export function rankScores(scores: RoundScore[]): Ranked[] {
  const sorted = [...scores].sort(compareScores);
  return sorted.map((s, i) => {
    const same = (o?: RoundScore) => !!o && o.score === s.score && o.timeMs === s.timeMs;
    let rank = i + 1;
    // Так тең болгондор бир орунду бөлүшөт
    for (let j = i - 1; j >= 0 && same(sorted[j]); j--) rank = j + 1;
    return { ...s, rank, tied: same(sorted[i - 1]) || same(sorted[i + 1]) };
  });
}

export const rankRound = (game: FullGame, round: Round) => rankScores(roundScores(game, round));

/** Тур аягында: кийинки турга сунушталган оюнчулар жана чек арада так тең чыгуу барбы */
export function advanceSuggestion(game: FullGame, round: Round) {
  const count = round === 'ROUND1' ? game.advanceToRound2 : round === 'ROUND2' ? game.advanceToFinal : 3;
  const ranking = rankRound(game, round);
  const suggested = ranking.slice(0, count).map((r) => r.playerId);
  const last = ranking[count - 1];
  const next = ranking[count];
  const tieAtCutoff = !!last && !!next && last.score === next.score && last.timeMs === next.timeMs;
  return { round, count, ranking, suggested, tieAtCutoff };
}

export interface Standing {
  playerId: number;
  name: string;
  status: string;
  reached: Round;
  rounds: Partial<Record<Round, { score: number; timeMs: number; correct: number }>>;
  total: number;
  place: number;
}

/**
 * Жалпы жыйынтык: алгач эң алыс жеткен тур (финалисттер жогору),
 * андан кийин ошол турдагы упай жана убакыт боюнча.
 */
export function overallStandings(game: FullGame): Standing[] {
  const perRound = Object.fromEntries(
    ROUNDS.map((r) => [r, new Map(roundScores(game, r).map((s) => [s.playerId, s]))]),
  ) as Record<Round, Map<number, RoundScore>>;

  const rows = game.players
    .filter((p) => p.status !== 'KICKED')
    .map((p) => {
      const rounds: Standing['rounds'] = {};
      let reached: Round = 'ROUND1';
      for (const r of ROUNDS) {
        if (!playedRound(p, r)) continue;
        // Оюн али бул турга жете элек болсо — көрсөтпөйбүз
        if (game.status !== 'FINISHED' && game.status !== 'LOBBY') {
          if (roundIndex(r) > roundIndex(game.status as Round)) continue;
        }
        const s = perRound[r].get(p.id);
        if (s) {
          rounds[r] = { score: s.score, timeMs: s.timeMs, correct: s.correct };
          reached = r;
        }
      }
      const total = Object.values(rounds).reduce((sum, x) => sum + (x?.score ?? 0), 0);
      return { playerId: p.id, name: p.name, status: p.status, reached, rounds, total, place: 0 };
    });

  rows.sort((a, b) => {
    const byRound = roundIndex(b.reached) - roundIndex(a.reached);
    if (byRound) return byRound;
    const empty = { score: 0, timeMs: 0, correct: 0 };
    const sa = a.rounds[a.reached] ?? empty;
    const sb = b.rounds[b.reached] ?? empty;
    return compareScores({ ...sa, playerId: 0, name: '' }, { ...sb, playerId: 0, name: '' });
  });
  rows.forEach((r, i) => (r.place = i + 1));
  return rows;
}
