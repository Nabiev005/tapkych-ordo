/**
 * Ачык жооп (OPEN) суроолорун текшерүү: оюнчу жоопту өзү жазат.
 * Туура жооп — optionA, кошумча кабыл алынуучу жазылыштар — optionB/C/D (бош болушу мүмкүн).
 */

export const OPEN_MAX_LENGTH = 100;

/**
 * Салыштыруу үчүн нормалдаштыруу: кичине тамга, тыныш белгилери жана тырмакчалар алынат,
 * ё→е, ал эми ң/ө/ү → н/о/у (баскычтопто кыргыз тамгалары жок болушу мүмкүн).
 */
export function normalizeOpen(s: string): string {
  return s
    .toLocaleLowerCase('ky')
    .replace(/ё/g, 'е')
    .replace(/ң/g, 'н')
    .replace(/ө/g, 'о')
    .replace(/ү/g, 'у')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Левенштейн аралыгы (кыска саптар үчүн жөнөкөй вариант) */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Кичине жазуу катасына уруксат: 5+ белги — 1 ката, 9+ белги — 2 ката. Сандар так дал келиши керек. */
function allowedTypos(answer: string): number {
  if (/\d/.test(answer)) return 0;
  return answer.length >= 9 ? 2 : answer.length >= 5 ? 1 : 0;
}

export function checkOpen(accepted: string[], given: string): boolean {
  const g = normalizeOpen(given);
  if (!g) return false;
  return accepted
    .map(normalizeOpen)
    .filter(Boolean)
    .some((a) => a === g || distance(a, g) <= allowedTypos(a));
}

export const openAccepted = (q: { optionA: string; optionB: string; optionC: string; optionD: string }) =>
  [q.optionA, q.optionB, q.optionC, q.optionD].filter((x) => x.trim());
