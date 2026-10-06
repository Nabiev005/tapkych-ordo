import type { Difficulty, OptionKey, QuestionType, RoundKey } from '../i18n/ky';

export type GameStatus = 'LOBBY' | RoundKey | 'FINISHED';
export type Phase = 'IDLE' | 'READY' | 'QUESTION' | 'REVEAL' | 'ROUND_END';
export type PlayerStatus = 'ACTIVE' | 'ELIMINATED' | 'KICKED';

export interface Question {
  id: number;
  round: RoundKey;
  order: number;
  type: QuestionType;
  category: string;
  difficulty: Difficulty;
  text: string;
  imageUrl: string | null;
  audioUrl: string | null;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  /** CHOICE/TF: A|B|C|D; ORDER: туура тартип, мис. "CADB" */
  correct: string;
  archived: boolean;
  usedCount: number;
  lastUsedAt: string | null;
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
  teamMode: boolean;
  speedBonus: number;
  fiftyFifty: boolean;
  selectionMode: 'ORDER' | 'DIFFICULTY';
  categories: string;
}

export interface GameRow extends Settings {
  id: number;
  code: string;
  title: string | null;
  status: GameStatus;
  createdAt: string;
  ownerId: number | null;
  owner?: { name: string } | null;
  players: { id: number; name: string; pin: string; status: PlayerStatus; joinedAt: string | null; seat: number; team: string; studentId: number | null }[];
  _count?: { players: number };
}

export interface BaseGame {
  id: number;
  code: string;
  title: string | null;
  status: GameStatus;
  phase: Phase;
  paused: boolean;
  showLeaderboard: boolean;
  soundEnabled: boolean;
  timerSeconds: number;
  teamMode: boolean;
  fiftyFifty: boolean;
  speedBonus: number;
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

export interface TeamStanding {
  team: string;
  members: number;
  total: number;
  average: number;
  correct: number;
  place: number;
}

export type Options = Record<OptionKey, string>;

/** Суроонун экранга/телефонго жөнөтүлгөн жалпы бөлүгү */
export interface QuestionInfo {
  number: number;
  type: QuestionType;
  category: string;
  text: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  options: Options | null;
}

export interface AudienceStats {
  total: number;
  counts: Record<OptionKey, number> | null;
}

export interface AdminState {
  role: 'admin';
  serverNow: number;
  game: BaseGame & { settings: Settings };
  bank: Record<RoundKey, number>;
  bankTotal: number;
  players: {
    id: number;
    name: string;
    pin: string;
    team: string;
    status: PlayerStatus;
    eliminatedAfter: RoundKey | null;
    joined: boolean;
    online: boolean;
    fiftyUsed: boolean;
  }[];
  activeIds: number[];
  question:
    | (QuestionInfo & {
        id: number;
        text: string;
        options: Options;
        correct: string;
        startedAt: number | null;
        revealed: boolean;
        stats: Record<OptionKey, number> | null;
        audience: { total: number; counts: Record<OptionKey, number> };
      })
    | null;
  answers: Record<string, { choice: string; isCorrect: boolean; responseMs: number; bonus: number }>;
  leaderboard: Ranked[];
  roundEnd: { round: RoundKey; count: number; ranking: Ranked[]; suggested: number[]; tieAtCutoff: boolean } | null;
  standings: Standing[];
  teams: TeamStanding[];
  askedQuestions: {
    id: number;
    round: RoundKey;
    number: number;
    type: QuestionType;
    text: string;
    correct: string;
    correctText: string;
    answered: number;
    correctCount: number;
  }[];
}

export interface ScreenState {
  role: 'screen';
  serverNow: number;
  game: BaseGame;
  players: { id: number; name: string; team: string; online: boolean; answered: boolean; correct: boolean | null; bonus: number }[];
  question:
    | (QuestionInfo & {
        correct: string | null;
        stats: Record<OptionKey, number> | null;
        audience: AudienceStats;
      })
    | null;
  leaderboard: Ranked[] | null;
  teams: TeamStanding[] | null;
  qualifiers: { id: number; name: string }[] | null;
  standings: Standing[] | null;
  finalRanking: Ranked[] | null;
}

export interface PlayerState {
  role: 'player';
  serverNow: number;
  game: BaseGame;
  me: { id: number; name: string; status: PlayerStatus; eliminatedAfter: RoundKey | null; team: string } | null;
  inRound: boolean;
  fiftyAvailable: boolean;
  question:
    | (QuestionInfo & {
        hidden: OptionKey[];
        myChoice: string | null;
        correct: string | null;
        myCorrect: boolean | null;
        myPoints: number | null;
        myBonus: number | null;
      })
    | null;
  roundScore: number;
  roundRank: number | null;
  roundPlayers: number;
  final: { place: number; total: number; rounds: Standing['rounds'] } | null;
  teamFinal: { team: string; place: number; total: number } | null;
}

export interface AudienceState {
  role: 'audience';
  serverNow: number;
  game: BaseGame;
  question: (QuestionInfo & { myVote: string | null; correct: string | null; audience: AudienceStats | null }) | null;
}

export const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D'];
export const ROUND_KEYS: RoundKey[] = ['ROUND1', 'ROUND2', 'FINAL'];
export const QUESTION_TYPES: QuestionType[] = ['CHOICE', 'TF', 'ORDER'];
export const DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];

/** Суроонун түрүнө жараша көрсөтүлүүчү варианттар (TF — экөө гана) */
export const optionKeysFor = (type: QuestionType): OptionKey[] => (type === 'TF' ? ['A', 'B'] : OPTION_KEYS);

export interface Student {
  id: number;
  name: string;
  className: string;
  _count?: { players: number };
}

export interface RatingRow {
  studentId: number;
  name: string;
  className: string;
  games: number;
  tasks: number;
  wins: number;
  podiums: number;
  finals: number;
  totalScore: number;
  correct: number;
  answered: number;
  accuracy: number;
  bestPlace: number | null;
  lastPlayedAt: string | null;
}

export interface StudentProfile {
  student: { id: number; name: string; className: string };
  rank: number | null;
  of: number;
  stats: RatingRow | null;
  games: { gameId: number; title: string | null; date: string; place: number; players: number; total: number; reached: RoundKey; correct: number; answered: number }[];
  tasks: { assignmentId: number; title: string; date: string; score: number; correct: number; total: number }[];
  timeline: { date: string; kind: 'game' | 'task'; title: string | null; score: number; cumulative: number }[];
  categories: { category: string; correct: number; answered: number; accuracy: number }[];
}

export interface Season {
  id: number;
  name: string;
  startsAt: string;
  endsAt: string;
}

export interface Teacher {
  id: number;
  username: string;
  name: string;
  createdAt: string;
  _count: { questions: number; games: number; assignments: number };
}

export interface AssignmentRow {
  id: number;
  code: string;
  title: string;
  timerSeconds: number;
  active: boolean;
  open: boolean;
  closesAt: string | null;
  createdAt: string;
  questions: number;
  started: number;
  finished: number;
}

export interface AssignmentDetail extends Omit<AssignmentRow, 'questions' | 'started' | 'finished'> {
  questions: { id: number; order: number; type: QuestionType; text: string; correctLabel: string }[];
  submissions: {
    id: number;
    name: string;
    className: string;
    score: number;
    correct: number;
    total: number;
    answered: number;
    durationMs: number;
    startedAt: string;
    finishedAt: string | null;
    answers: { choice: string | null; correct: boolean; ms: number; label: string | null }[];
  }[];
}

export interface HistoryGame {
  id: number;
  code: string;
  title: string | null;
  teamMode: boolean;
  createdAt: string;
  finishedAt: string | null;
  players: number;
  questions: number;
  top: { name: string; total: number }[];
}

export interface ReplayStep {
  round: RoundKey;
  number: number;
  type: QuestionType;
  category: string;
  text: string;
  imageUrl: string | null;
  options: Options;
  correct: string;
  answers: { playerId: number; name: string; choice: string; isCorrect: boolean; responseMs: number; points: number; bonus: number }[];
  notAnswered: string[];
  audience: Partial<Record<OptionKey, number>>;
  leaderboard: Ranked[];
}
