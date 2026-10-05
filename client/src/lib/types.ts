import type { OptionKey, RoundKey } from '../i18n/ky';

export type GameStatus = 'LOBBY' | RoundKey | 'FINISHED';
export type Phase = 'IDLE' | 'READY' | 'QUESTION' | 'REVEAL' | 'ROUND_END';
export type PlayerStatus = 'ACTIVE' | 'ELIMINATED' | 'KICKED';

export interface Question {
  id: number;
  round: RoundKey;
  order: number;
  text: string;
  imageUrl: string | null;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correct: OptionKey;
}

export interface Settings {
  pointsPerCorrect: number;
  timerSeconds: number;
  round1Count: number;
  round2Count: number;
  finalQuestionCount: number;
  advanceToRound2: number;
  advanceToFinal: number;
  expectedPlayers: number;
  soundEnabled: boolean;
}

export interface GameRow extends Settings {
  id: number;
  code: string;
  status: GameStatus;
  createdAt: string;
  players: { id: number; name: string; pin: string; status: PlayerStatus; joinedAt: string | null; seat: number }[];
  _count?: { players: number };
}

export interface BaseGame {
  id: number;
  code: string;
  status: GameStatus;
  phase: Phase;
  paused: boolean;
  showLeaderboard: boolean;
  soundEnabled: boolean;
  timerSeconds: number;
  round: RoundKey | null;
  index: number;
  total: number;
  endsAt: number | null;
  pausedRemainingMs: number | null;
}

export interface Ranked {
  playerId: number;
  name: string;
  score: number;
  timeMs: number;
  correct: number;
  rank: number;
  tied: boolean;
}

export interface Standing {
  playerId: number;
  name: string;
  status: PlayerStatus;
  reached: RoundKey;
  rounds: Partial<Record<RoundKey, { score: number; timeMs: number; correct: number }>>;
  total: number;
  place: number;
}

export type Options = Record<OptionKey, string>;

export interface AdminState {
  role: 'admin';
  serverNow: number;
  game: BaseGame & { settings: Settings };
  bank: Record<RoundKey, number>;
  players: {
    id: number;
    name: string;
    pin: string;
    status: PlayerStatus;
    eliminatedAfter: RoundKey | null;
    joined: boolean;
    online: boolean;
  }[];
  activeIds: number[];
  question: {
    id: number;
    number: number;
    text: string;
    imageUrl: string | null;
    options: Options;
    correct: OptionKey;
    startedAt: number | null;
    revealed: boolean;
    stats: Record<OptionKey, number>;
  } | null;
  answers: Record<string, { choice: OptionKey; isCorrect: boolean; responseMs: number }>;
  leaderboard: Ranked[];
  roundEnd: { round: RoundKey; count: number; ranking: Ranked[]; suggested: number[]; tieAtCutoff: boolean } | null;
  standings: Standing[];
}

export interface ScreenState {
  role: 'screen';
  serverNow: number;
  game: BaseGame;
  players: { id: number; name: string; online: boolean; answered: boolean; correct: boolean | null }[];
  question: {
    number: number;
    text: string | null;
    imageUrl: string | null;
    options: Options | null;
    correct: OptionKey | null;
    stats: Record<OptionKey, number> | null;
  } | null;
  leaderboard: Ranked[] | null;
  qualifiers: { id: number; name: string }[] | null;
  standings: Standing[] | null;
  finalRanking: Ranked[] | null;
}

export interface PlayerState {
  role: 'player';
  serverNow: number;
  game: BaseGame;
  me: { id: number; name: string; status: PlayerStatus; eliminatedAfter: RoundKey | null } | null;
  inRound: boolean;
  question: {
    number: number;
    text: string | null;
    imageUrl: string | null;
    options: Options | null;
    myChoice: OptionKey | null;
    correct: OptionKey | null;
    myCorrect: boolean | null;
    myPoints: number | null;
  } | null;
  roundScore: number;
  roundRank: number | null;
  roundPlayers: number;
  final: { place: number; total: number; rounds: Standing['rounds'] } | null;
}

export const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D'];
export const ROUND_KEYS: RoundKey[] = ['ROUND1', 'ROUND2', 'FINAL'];
