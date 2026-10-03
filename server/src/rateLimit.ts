import { AppError } from './types.js';

/**
 * Жөнөкөй эс тутумдагы чектөөчү: PIN кодду тандап табууга (brute force) бөгөт коёт.
 * Ката аракеттер гана эсептелет.
 */
export class FailLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private maxFails: number,
    private windowMs: number,
  ) {}

  check(key: string) {
    const now = Date.now();
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    this.hits.set(key, list);
    if (list.length >= this.maxFails) throw new AppError('TOO_MANY_ATTEMPTS', 429);
  }

  fail(key: string) {
    const list = this.hits.get(key) ?? [];
    list.push(Date.now());
    this.hits.set(key, list);
  }

  reset(key: string) {
    this.hits.delete(key);
  }
}
