// Абалдардын мүмкүн болгон маанилери (SQLite'та String катары сакталат)

export const ROUNDS = ['ROUND1', 'ROUND2', 'FINAL'] as const;
export type Round = (typeof ROUNDS)[number];

export const OPTIONS = ['A', 'B', 'C', 'D'] as const;
export type Option = (typeof OPTIONS)[number];

export type GameStatus = 'LOBBY' | Round | 'FINISHED';
/**
 * IDLE      — тур башталды, биринчи суроо күтүлүүдө (экранда «1-ТУР» же өткөндөр)
 * READY     — суроонун номери көрүнөт, тексти жашырылган
 * QUESTION  — суроо көрсөтүлдү, таймер жүрүп жатат
 * REVEAL    — туура жооп ачылды
 * ROUND_END — тур аяктады, алып баруучу өткөндөрдү ырастайт
 */
export type Phase = 'IDLE' | 'READY' | 'QUESTION' | 'REVEAL' | 'ROUND_END';

export const nextRound = (r: Round): Round | null =>
  r === 'ROUND1' ? 'ROUND2' : r === 'ROUND2' ? 'FINAL' : null;
export type PlayerStatus = 'ACTIVE' | 'ELIMINATED' | 'KICKED';

/**
 * Ката коддору. Сервер кардарга текст эмес, код жөнөтөт —
 * кыргызча котормосу client/src/i18n/ky.ts файлында (errors бөлүмү).
 */
export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'INVALID_CREDENTIALS'
  | 'NOT_FOUND'
  | 'GAME_NOT_FOUND'
  | 'INVALID_PIN'
  | 'PLAYER_KICKED'
  | 'TOO_MANY_ATTEMPTS'
  | 'GAME_ALREADY_STARTED'
  | 'DUPLICATE_NAME'
  | 'INVALID_FILE'
  | 'NOT_ENOUGH_QUESTIONS'
  | 'NOT_ENOUGH_PLAYERS'
  | 'INVALID_ACTION'
  | 'GAME_PAUSED'
  | 'ALREADY_ANSWERED'
  | 'TIME_UP'
  | 'NOT_IN_ROUND'
  | 'SERVER_ERROR';

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public status = 400,
    public details?: unknown,
  ) {
    super(code);
  }
}
