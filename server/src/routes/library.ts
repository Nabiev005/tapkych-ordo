import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { ownerKey, requireAdmin, requireSuper, staff, type StaffUser } from '../auth.js';
import { AppError, DIFFICULTIES, QUESTION_TYPES, ROUNDS, type Round } from '../types.js';
import { nextOrder, questionSchema } from './questions.js';
import { parseQuestionRows, readRows } from './importExport.js';
import { STARTER_LIBRARY, STARTER_PACKS, buildPack } from '../library/starter.js';

/**
 * Жалпы суроолор китепканасы.
 *  - Бардык мугалимдер ырасталган (APPROVED) суроолорду көрөт жана өз банкына көчүрөт.
 *  - Мугалим өз банкынан бөлүшсө — PENDING, башкы алып баруучу ырастайт же четке кагат.
 *  - Башкы алып баруучу түз кошот/оңдойт/өчүрөт, Excel'ден жүктөйт, баштапкы топтомду кошот.
 */
export const libraryRouter = Router();
libraryRouter.use(requireAdmin);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const STATUSES = ['PENDING', 'APPROVED'] as const;
const idsSchema = z.array(z.number().int()).min(1).max(500);

/** Кыйынчылыкка жараша тур: жеңил → 1-тур, орто → 2-тур, кыйын → финал */
const AUTO_ROUND: Record<string, Round> = { EASY: 'ROUND1', MEDIUM: 'ROUND2', HARD: 'FINAL' };

/** Суроо китепкана үчүн текшерилет (тур талап кылынбайт) */
function parseLibraryQuestion(body: unknown) {
  const { round: _round, ...q } = questionSchema.parse({ ...(body as object), round: 'ROUND1' });
  return { ...q, imageUrl: q.imageUrl || null, audioUrl: q.audioUrl || null };
}

/** Тексттин кайталанышын текшерүү үчүн: боштуктар жана чоң/кичине тамга эсепке алынбайт */
const norm = (s: string) => s.toLocaleLowerCase('ky').replace(/\s+/g, ' ').trim();

async function existingTexts(): Promise<Set<string>> {
  const all = await prisma.libraryQuestion.findMany({ select: { text: true } });
  return new Set(all.map((x) => norm(x.text)));
}

const isSuper = (u: StaffUser) => u.role === 'admin';

const listQuery = z.object({
  status: z.enum(STATUSES).optional(),
  category: z.string().trim().max(40).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  type: z.enum(QUESTION_TYPES).optional(),
  q: z.string().trim().max(100).optional(),
  mine: z.enum(['1']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

libraryRouter.get('/', async (req, res) => {
  const user = staff(res);
  const f = listQuery.parse(req.query);
  // Мугалим: ырасталгандар, же «менин бөлүшкөндөрүм» (бардык абалда)
  const mine = f.mine === '1' && user.teacherId !== null;
  const status = mine ? undefined : isSuper(user) ? (f.status ?? 'APPROVED') : 'APPROVED';
  const scope: Prisma.LibraryQuestionWhereInput = { ...(status ? { status } : {}), ...(mine ? { authorId: user.teacherId } : {}) };
  const where: Prisma.LibraryQuestionWhereInput = {
    ...scope,
    ...(f.category ? { category: f.category } : {}),
    ...(f.difficulty ? { difficulty: f.difficulty } : {}),
    ...(f.type ? { type: f.type } : {}),
    ...(f.q ? { OR: [{ text: { contains: f.q } }, { optionA: { contains: f.q } }, { optionB: { contains: f.q } }, { optionC: { contains: f.q } }, { optionD: { contains: f.q } }] } : {}),
  };
  const [items, total, cats, pendingCount, inBank] = await Promise.all([
    prisma.libraryQuestion.findMany({
      where,
      orderBy: [{ category: 'asc' }, { id: 'asc' }],
      skip: f.offset,
      take: f.limit,
      include: { author: { select: { name: true } } },
    }),
    prisma.libraryQuestion.count({ where }),
    prisma.libraryQuestion.groupBy({ by: ['category'], where: scope, _count: { _all: true } }),
    isSuper(user) ? prisma.libraryQuestion.count({ where: { status: 'PENDING' } }) : Promise.resolve(0),
    prisma.question.findMany({ where: { ownerId: ownerKey(user), libraryId: { not: null } }, select: { libraryId: true } }),
  ]);
  res.json({
    items: items.map(({ author, ...x }) => ({ ...x, authorName: author?.name ?? null })),
    total,
    categories: cats
      .filter((c) => c.category)
      .map((c) => ({ name: c.category, count: c._count._all }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ky')),
    pendingCount,
    inBank: [...new Set(inBank.map((x) => x.libraryId!))],
  });
});

/**
 * Китепкана суроолорун ээсинин банкына көчүрөт (ар бири көрсөтүлгөн турга).
 * Ырасталбаган жана мурун көчүрүлгөн суроолор өткөрүлүп жиберилет.
 */
async function copyToBank(ownerId: number | null, wanted: { id: number; round: Round }[]) {
  const items = await prisma.libraryQuestion.findMany({ where: { id: { in: wanted.map((w) => w.id) }, status: 'APPROVED' } });
  const already = new Set(
    (await prisma.question.findMany({ where: { ownerId, libraryId: { in: items.map((x) => x.id) } }, select: { libraryId: true } })).map((x) => x.libraryId),
  );
  // Сурам кылынган тартип сакталат
  const fresh = wanted.map((w) => ({ w, x: items.find((i) => i.id === w.id) })).filter(({ x }) => x && !already.has(x.id)) as { w: (typeof wanted)[number]; x: (typeof items)[number] }[];

  const orders = new Map<Round, number>();
  for (const r of ROUNDS) orders.set(r, await nextOrder(ownerId, r));
  const data: Prisma.QuestionCreateManyInput[] = fresh.map(({ w, x }) => {
    const r = w.round;
    const order = orders.get(r)!;
    orders.set(r, order + 1);
    return {
      ownerId,
      round: r,
      order,
      type: x.type,
      category: x.category,
      difficulty: x.difficulty,
      text: x.text,
      imageUrl: x.imageUrl,
      audioUrl: x.audioUrl,
      optionA: x.optionA,
      optionB: x.optionB,
      optionC: x.optionC,
      optionD: x.optionD,
      correct: x.correct,
      libraryId: x.id,
    };
  });
  if (data.length) {
    await prisma.$transaction([
      prisma.question.createMany({ data }),
      prisma.libraryQuestion.updateMany({ where: { id: { in: fresh.map(({ x }) => x.id) } }, data: { copiedCount: { increment: 1 } } }),
    ]);
  }
  const counts = Object.fromEntries(ROUNDS.map((r) => [r, data.filter((d) => d.round === r).length]));
  return { copied: data.length, skipped: wanted.length - data.length, counts };
}

/** Ырасталган суроолорду өз банкына көчүрүү. AUTO — кыйынчылыгына жараша тур. */
libraryRouter.post('/copy', async (req, res) => {
  const { ids, round } = z.object({ ids: idsSchema, round: z.union([z.literal('AUTO'), z.enum(ROUNDS)]).default('AUTO') }).parse(req.body);
  const difficulty = new Map((await prisma.libraryQuestion.findMany({ where: { id: { in: ids } }, select: { id: true, difficulty: true } })).map((x) => [x.id, x.difficulty]));
  const wanted = [...new Set(ids)].sort((a, b) => a - b).map((id) => ({ id, round: round === 'AUTO' ? (AUTO_ROUND[difficulty.get(id) ?? ''] ?? 'ROUND1') : round }));
  res.json(await copyToBank(ownerKey(staff(res)), wanted));
});

// ───────────────────────── Оюн пакеттери ─────────────────────────

/** Пакеттер. Мугалим ырасталган суроолору бар пакеттерди гана көрөт. */
libraryRouter.get('/packs', async (_req, res) => {
  const user = staff(res);
  const packs = await prisma.libraryPack.findMany({
    orderBy: { createdAt: 'asc' },
    include: { items: { include: { question: { select: { status: true } } }, orderBy: [{ round: 'asc' }, { order: 'asc' }] } },
  });
  const inBank = new Set(
    (await prisma.question.findMany({ where: { ownerId: ownerKey(user), libraryId: { not: null } }, select: { libraryId: true } })).map((x) => x.libraryId),
  );
  const list = packs.map((p) => {
    const approved = p.items.filter((i) => i.question.status === 'APPROVED');
    return {
      id: p.id,
      title: p.title,
      description: p.description,
      icon: p.icon,
      counts: Object.fromEntries(ROUNDS.map((r) => [r, approved.filter((i) => i.round === r).length])),
      total: approved.length,
      pending: p.items.length - approved.length,
      inBank: approved.filter((i) => inBank.has(i.questionId)).length,
    };
  });
  res.json({ packs: isSuper(user) ? list : list.filter((p) => p.total > 0).map((p) => ({ ...p, pending: 0 })) });
});

/** Пакеттин бардык (ырасталган) суроолорун өз турлары менен банкка көчүрүү */
libraryRouter.post('/packs/:id/copy', async (req, res) => {
  const id = Number(req.params.id);
  const pack = Number.isInteger(id) ? await prisma.libraryPack.findUnique({ where: { id }, include: { items: { orderBy: [{ round: 'asc' }, { order: 'asc' }] } } }) : null;
  if (!pack) throw new AppError('NOT_FOUND', 404);
  const wanted = [...pack.items]
    .sort((a, b) => ROUNDS.indexOf(a.round as Round) - ROUNDS.indexOf(b.round as Round) || a.order - b.order)
    .map((i) => ({ id: i.questionId, round: i.round as Round }));
  res.json(await copyToBank(ownerKey(staff(res)), wanted));
});

const packSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).default(''),
  icon: z.string().trim().min(1).max(8).default('🎁'),
  items: z.array(z.object({ id: z.number().int(), round: z.enum(ROUNDS) })).min(1).max(150),
});

libraryRouter.post('/packs', requireSuper, async (req, res) => {
  const body = packSchema.parse(req.body);
  if (await prisma.libraryPack.findUnique({ where: { title: body.title } })) throw new AppError('DUPLICATE_NAME');
  const existing = new Set((await prisma.libraryQuestion.findMany({ where: { id: { in: body.items.map((i) => i.id) } }, select: { id: true } })).map((x) => x.id));
  const items = [...new Map(body.items.filter((i) => existing.has(i.id)).map((i) => [i.id, i])).values()];
  if (!items.length) throw new AppError('BAD_REQUEST');
  const order = new Map<Round, number>();
  const pack = await prisma.libraryPack.create({
    data: {
      title: body.title,
      description: body.description,
      icon: body.icon,
      items: {
        create: items.map((i) => {
          const n = order.get(i.round) ?? 0;
          order.set(i.round, n + 1);
          return { questionId: i.id, round: i.round, order: n };
        }),
      },
    },
  });
  res.status(201).json({ pack });
});

libraryRouter.delete('/packs/:id', requireSuper, async (req, res) => {
  const id = Number(req.params.id);
  await prisma.libraryPack.delete({ where: { id: Number.isInteger(id) ? id : -1 } }).catch(() => {
    throw new AppError('NOT_FOUND', 404);
  });
  res.json({ ok: true });
});

/** Өз банкындагы суроолорду китепканага бөлүшүү (мугалимдики — модерацияга) */
libraryRouter.post('/share', async (req, res) => {
  const user = staff(res);
  const { questionIds } = z.object({ questionIds: idsSchema }).parse(req.body);
  const own = await prisma.question.findMany({ where: { id: { in: questionIds }, ownerId: ownerKey(user) } });
  const seen = await existingTexts();
  const data: Prisma.LibraryQuestionCreateManyInput[] = [];
  for (const q of own) {
    // Китепканадан алынган суроо же китепканада бар текст кайра бөлүшүлбөйт
    if (q.libraryId || seen.has(norm(q.text))) continue;
    seen.add(norm(q.text));
    data.push({
      authorId: user.teacherId,
      status: isSuper(user) ? 'APPROVED' : 'PENDING',
      type: q.type,
      category: q.category,
      difficulty: q.difficulty,
      text: q.text,
      imageUrl: q.imageUrl,
      audioUrl: q.audioUrl,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correct: q.correct,
    });
  }
  if (data.length) await prisma.libraryQuestion.createMany({ data });
  res.json({ shared: data.length, skipped: questionIds.length - data.length, pending: !isSuper(user) });
});

/** Автор (мугалим) өзүнүн ырастала элек суроосун кайра ала алат; башкы алып баруучу — каалаганын */
libraryRouter.delete('/:id', async (req, res) => {
  const user = staff(res);
  const id = Number(req.params.id);
  const item = Number.isInteger(id) ? await prisma.libraryQuestion.findUnique({ where: { id } }) : null;
  if (!item) throw new AppError('NOT_FOUND', 404);
  if (!isSuper(user) && !(item.authorId === user.teacherId && item.status === 'PENDING')) throw new AppError('FORBIDDEN', 403);
  await prisma.libraryQuestion.delete({ where: { id } });
  res.json({ ok: true });
});

// ───────────────────────── Башкы алып баруучу гана ─────────────────────────

libraryRouter.post('/', requireSuper, async (req, res) => {
  const q = parseLibraryQuestion(req.body);
  if ((await existingTexts()).has(norm(q.text))) throw new AppError('DUPLICATE_QUESTION');
  const item = await prisma.libraryQuestion.create({ data: { ...q, status: 'APPROVED' } });
  res.status(201).json({ item });
});

libraryRouter.put('/:id', requireSuper, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError('BAD_REQUEST');
  const q = parseLibraryQuestion(req.body);
  const item = await prisma.libraryQuestion.update({ where: { id }, data: q }).catch(() => {
    throw new AppError('NOT_FOUND', 404);
  });
  res.json({ item });
});

libraryRouter.post('/approve', requireSuper, async (req, res) => {
  const { ids } = z.object({ ids: idsSchema }).parse(req.body);
  const r = await prisma.libraryQuestion.updateMany({ where: { id: { in: ids }, status: 'PENDING' }, data: { status: 'APPROVED' } });
  res.json({ approved: r.count });
});

/** Четке кагуу = ырастала элек суроону өчүрүү */
libraryRouter.post('/reject', requireSuper, async (req, res) => {
  const { ids } = z.object({ ids: idsSchema }).parse(req.body);
  const r = await prisma.libraryQuestion.deleteMany({ where: { id: { in: ids }, status: 'PENDING' } });
  res.json({ rejected: r.count });
});

/** Excel/CSV'ден китепканага жүктөө (суроолор банкынын шаблону; «Тур» мамычасы эске алынбайт) */
libraryRouter.post('/import', requireSuper, upload.single('file'), async (req, res) => {
  if (!req.file) throw new AppError('INVALID_FILE');
  const { valid, errors } = parseQuestionRows(await readRows(req.file), true);
  const seen = await existingTexts();
  const data: Prisma.LibraryQuestionCreateManyInput[] = [];
  for (const { round: _round, ...q } of valid) {
    if (seen.has(norm(q.text))) continue;
    seen.add(norm(q.text));
    data.push({ ...q, status: 'APPROVED' });
  }
  if (data.length) await prisma.libraryQuestion.createMany({ data });
  res.json({ imported: data.length, duplicates: valid.length - data.length, errors });
});

/**
 * Баштапкы топтом: Кыргызстан, «Манас», илим ж.б. боюнча даяр суроолор.
 * Модерацияга (PENDING) түшөт — башкы алып баруучу фактыларды текшерип ырастайт.
 */
libraryRouter.post('/starter', requireSuper, async (_req, res) => {
  const seen = await existingTexts();
  const data = STARTER_LIBRARY.filter((q) => !seen.has(norm(q.text))).map((q) => ({ ...parseLibraryQuestion(q), status: 'PENDING' }));
  if (data.length) await prisma.libraryQuestion.createMany({ data });

  // Даяр пакеттер: баштапкы топтомдун суроолорунан (тексти боюнча табылат; мурун түзүлгөн пакет кайра түзүлбөйт)
  const starterTexts = new Set(STARTER_LIBRARY.map((q) => norm(q.text)));
  const pool = (await prisma.libraryQuestion.findMany({ orderBy: { id: 'asc' } })).filter((q) => starterTexts.has(norm(q.text)));
  let packs = 0;
  for (const p of STARTER_PACKS) {
    if (await prisma.libraryPack.findUnique({ where: { title: p.title } })) continue;
    const items = buildPack(pool, p.categories);
    if (!items.length) continue;
    const order = new Map<string, number>();
    await prisma.libraryPack.create({
      data: {
        title: p.title,
        description: p.description,
        icon: p.icon,
        items: {
          create: items.map((i) => {
            const n = order.get(i.round) ?? 0;
            order.set(i.round, n + 1);
            return { questionId: i.id, round: i.round, order: n };
          }),
        },
      },
    });
    packs++;
  }
  res.json({ added: data.length, skipped: STARTER_LIBRARY.length - data.length, packs });
});
