import { prisma } from '../db.js';

/**
 * Суроолор боюнча статистика: канча жолу жооп берилди жана канчасы туура.
 * Булактары: оюндардагы жооптор (Answer) жана студенттин кабинети (PracticeAttempt.details).
 * Өзүнчө сакталбайт — суралганда эсептелет (маалымат көп эмес).
 */
export interface QStat {
  answered: number;
  correct: number;
}

/** Пайыз көрсөтүү үчүн эң аз жооп саны (андан аз болсо — «маалымат аз») */
export const MIN_ANSWERS = 5;

function add(map: Map<number, QStat>, id: number, isCorrect: boolean) {
  const s = map.get(id) ?? { answered: 0, correct: 0 };
  s.answered++;
  if (isCorrect) s.correct++;
  map.set(id, s);
}

/** Китепкана суроолору: машыгуу + күндүн суроолору + банкка көчүрүлгөн нускалары менен оюндар */
export async function libraryStats(ids?: number[]): Promise<Map<number, QStat>> {
  const map = new Map<number, QStat>();
  const wanted = ids ? new Set(ids) : null;

  const attempts = await prisma.practiceAttempt.findMany({ select: { details: true } });
  for (const a of attempts) {
    let details: { id: number; choice: string | null; correct: string }[] = [];
    try {
      details = JSON.parse(a.details);
    } catch {
      continue;
    }
    for (const d of details) if (!wanted || wanted.has(d.id)) add(map, d.id, d.choice === d.correct);
  }

  const answers = await prisma.answer.findMany({
    where: { gameQuestion: { question: { libraryId: ids ? { in: ids } : { not: null } } } },
    select: { isCorrect: true, gameQuestion: { select: { question: { select: { libraryId: true } } } } },
  });
  for (const a of answers) {
    const id = a.gameQuestion.question?.libraryId;
    if (id) add(map, id, a.isCorrect);
  }
  return map;
}

/** Суроолор банкы: ушул суроо колдонулган бардык оюндардагы жооптор */
export async function bankStats(questionIds: number[]): Promise<Map<number, QStat>> {
  const map = new Map<number, QStat>();
  if (!questionIds.length) return map;
  const answers = await prisma.answer.findMany({
    where: { gameQuestion: { questionId: { in: questionIds } } },
    select: { isCorrect: true, gameQuestion: { select: { questionId: true } } },
  });
  for (const a of answers) if (a.gameQuestion.questionId) add(map, a.gameQuestion.questionId, a.isCorrect);
  return map;
}

/** Иреттөө үчүн тактык (маалымат аз болсо — null) */
export const accuracy = (s: QStat | undefined): number | null => (s && s.answered >= MIN_ANSWERS ? s.correct / s.answered : null);
