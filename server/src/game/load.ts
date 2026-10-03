import { prisma } from '../db.js';
import { ROUNDS, type Round } from '../types.js';

/** Оюндун бардык маалыматын бир суроо менен жүктөйт (оюнчулар, суроолор, жооптор, оңдоолор) */
export async function loadFull(gameId: number) {
  return prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: { orderBy: { seat: 'asc' } },
      questions: { orderBy: [{ round: 'asc' }, { order: 'asc' }], include: { answers: true } },
      adjustments: true,
    },
  });
}

export type FullGame = NonNullable<Awaited<ReturnType<typeof loadFull>>>;
export type FullPlayer = FullGame['players'][number];
export type FullQuestion = FullGame['questions'][number];

export const roundIndex = (r: Round) => ROUNDS.indexOf(r);

export function currentRound(game: { status: string }): Round | null {
  return (ROUNDS as readonly string[]).includes(game.status) ? (game.status as Round) : null;
}

export function roundQuestions(game: FullGame, round: Round): FullQuestion[] {
  return game.questions.filter((q) => q.round === round).sort((a, b) => a.order - b.order);
}

export function currentQuestion(game: FullGame): FullQuestion | null {
  const round = currentRound(game);
  if (!round || game.currentIndex < 0) return null;
  return roundQuestions(game, round)[game.currentIndex] ?? null;
}

export function roundSize(game: FullGame, round: Round): number {
  return round === 'ROUND1' ? game.round1Count : round === 'ROUND2' ? game.round2Count : game.finalQuestionCount;
}

/** Оюнчу ушул турга катышкан/катышып жатабы (чыгарылгандар эч жерде эсептелбейт) */
export function playedRound(p: FullPlayer, round: Round): boolean {
  if (p.status === 'KICKED') return false;
  if (!p.eliminatedAfter) return true;
  return roundIndex(p.eliminatedAfter as Round) >= roundIndex(round);
}

export function participants(game: FullGame, round: Round): FullPlayer[] {
  return game.players.filter((p) => playedRound(p, round));
}
