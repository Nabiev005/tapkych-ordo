import { ky, type OptionKey, type QuestionType } from '../i18n/ky';
import type { Options } from './types';

/** Жоопту түрүнө жараша кыскача көрсөтүү: «Б», «Туура», «В→А→Г→Б» */
export function answerLabel(type: QuestionType, choice: string | null | undefined): string {
  if (!choice) return '—';
  if (type === 'TF') return ky.tf[choice] ?? choice;
  if (type === 'ORDER') return [...choice].map((c) => ky.options[c as OptionKey] ?? c).join('→');
  return ky.options[choice as OptionKey] ?? choice;
}

/** Жоопту толук текст менен: «Б — Бишкек», «Туура», «3 → 1 → 4 → 2» */
export function answerText(type: QuestionType, choice: string | null | undefined, options: Options | null | undefined): string {
  if (!choice) return '—';
  if (type === 'TF') return ky.tf[choice] ?? choice;
  if (type === 'ORDER') return [...choice].map((c) => options?.[c as OptionKey] ?? c).join(' → ');
  return `${ky.options[choice as OptionKey] ?? choice} — ${options?.[choice as OptionKey] ?? ''}`;
}

/** Бир тамгалуу вариант үчүн (стилдер, баскычтар) */
export const asOption = (c: string | null | undefined): OptionKey | null => (c && 'ABCD'.includes(c) && c.length === 1 ? (c as OptionKey) : null);
