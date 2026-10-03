/**
 * Үн эффекттери — Web Audio API менен түзүлөт (файлдар керек эмес, интернетсиз да иштейт).
 * Браузерлер үндү колдонуучу экранды баскандан кийин гана уруксат беришет.
 */

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(v: boolean) {
  enabled = v;
}

export function unlockAudio(): boolean {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx.state === 'running';
  } catch {
    return false;
  }
}

export function audioUnlocked(): boolean {
  return !!ctx && ctx.state === 'running';
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.25) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function play(fn: () => void) {
  if (!enabled || !ctx || ctx.state !== 'running') return;
  try {
    fn();
  } catch {
    /* үн маанилүү эмес */
  }
}

export const sfx = {
  /** Таймердин ар секундалык чыкылдашы (акыркы секунддарда бийигирээк) */
  tick: (urgent = false) => play(() => tone(urgent ? 1100 : 800, 0, 0.07, 'square', urgent ? 0.12 : 0.06)),
  /** Суроо чыкты */
  question: () =>
    play(() => {
      tone(523, 0, 0.15, 'triangle');
      tone(784, 0.12, 0.25, 'triangle');
    }),
  /** Убакыт бүттү */
  timeUp: () =>
    play(() => {
      tone(220, 0, 0.5, 'sawtooth', 0.15);
      tone(165, 0.15, 0.6, 'sawtooth', 0.15);
    }),
  /** Туура жооп ачылды */
  correct: () =>
    play(() => {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.3, 'triangle', 0.22));
    }),
  /** Ката (телефон үчүн) */
  wrong: () =>
    play(() => {
      tone(300, 0, 0.25, 'sawtooth', 0.12);
      tone(220, 0.18, 0.35, 'sawtooth', 0.12);
    }),
  /** Турдан өтүү — салтанаттуу */
  advance: () =>
    play(() => {
      [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.35, 'triangle', 0.2));
    }),
  /** Рейтинг */
  whoosh: () =>
    play(() => {
      tone(400, 0, 0.18, 'sine', 0.1);
      tone(800, 0.08, 0.2, 'sine', 0.1);
    }),
  /** Жеңиш — фанфара */
  victory: () =>
    play(() => {
      const seq: [number, number, number][] = [
        [523, 0, 0.18], [523, 0.18, 0.18], [523, 0.36, 0.18], [659, 0.54, 0.5],
        [587, 1.05, 0.18], [659, 1.23, 0.18], [784, 1.41, 0.9],
      ];
      seq.forEach(([f, s, d]) => {
        tone(f, s, d, 'triangle', 0.25);
        tone(f / 2, s, d, 'sine', 0.12);
      });
    }),
  /** Оюнчу кошулду */
  join: () => play(() => tone(880, 0, 0.12, 'sine', 0.12)),
};

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* колдоого алынбайт */
  }
}
