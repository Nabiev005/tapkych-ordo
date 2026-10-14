import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, CircleCheckBig, CircleX, Dumbbell, Flame, PartyPopper, Play, Sun, Target, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { OPTION_STYLE } from '../../components/game';
import { LangSwitch } from '../../components/LangSwitch';
import { Logo, OrnamentBand, SunTunduk } from '../../components/Ornament';
import { Button, Spinner, useDialogs } from '../../components/ui';
import { fmtDateTime, ky } from '../../i18n/ky';
import { assetUrl, studentApi, studentToken } from '../../lib/api';
import { answerText } from '../../lib/questions';
import { OPTION_KEYS, optionKeysFor, type MeInfo, type PracticeQuestion, type PracticeResult } from '../../lib/types';

type Mode = { kind: 'daily' } | { kind: 'practice'; category: string };
type View = { name: 'home' } | { name: 'quiz'; mode: Mode; questions: PracticeQuestion[] } | { name: 'result'; mode: Mode; result: PracticeResult };

/** Студенттин кабинети: мугалим берген код менен кирет, күн сайын «Күндүн суроолорун» аткарат жана машыгат */
export default function Me() {
  const [token, setToken] = useState(studentToken.get());
  return (
    <div className="bg-night min-h-dvh text-white">
      <OrnamentBand height={18} />
      {token ? (
        <Cabinet
          onLogout={() => {
            studentToken.clear();
            setToken(null);
          }}
        />
      ) : (
        <Login onLogin={(tk) => setToken(tk)} />
      )}
    </div>
  );
}

function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const t = ky.student;
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await studentApi.post<{ token: string }>('/api/me/login', { code });
      studentToken.set(r.token);
      onLogin(r.token);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-10 text-center">
      <div className="flex w-full justify-between">
        <Link to="/">
          <Logo size="sm" />
        </Link>
        <LangSwitch dark />
      </div>
      <SunTunduk size={110} />
      <div>
        <h1 className="font-display text-3xl font-black text-gold-gradient">{t.loginTitle}</h1>
        <p className="mt-2 text-white/70">{t.loginHint}</p>
      </div>
      <form
        className="w-full space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          className="w-full rounded-2xl bg-white/10 px-5 py-4 text-center font-display text-3xl font-black tracking-[0.3em] uppercase text-white ring-2 ring-white/20 outline-none placeholder:text-white/25 placeholder:tracking-normal placeholder:text-lg focus:ring-ordo-gold"
          value={code}
          maxLength={10}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder={t.codePlaceholder}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
        />
        {error && <div className="rounded-xl bg-ordo-red/80 px-4 py-2 text-sm font-semibold">{error}</div>}
        <Button type="submit" variant="gold" size="lg" className="w-full" loading={busy} disabled={code.trim().length < 4}>
          {t.login}
        </Button>
      </form>
    </div>
  );
}

function Cabinet({ onLogout }: { onLogout: () => void }) {
  const t = ky.student;
  const { toast } = useDialogs();
  const [me, setMe] = useState<MeInfo | null>(null);
  const [view, setView] = useState<View>({ name: 'home' });
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    studentApi
      .get<MeInfo>('/api/me')
      .then(setMe)
      .catch((e) => {
        // Токен эскирди же студент өчүрүлдү — кайра кирүү керек
        if (!studentToken.get()) onLogout();
        else toast((e as Error).message, 'err');
      });
  useEffect(() => {
    void load();
  }, []);

  const startDaily = async () => {
    setBusy(true);
    try {
      const r = await studentApi.get<{ done: boolean; questions?: PracticeQuestion[]; result?: PracticeResult }>('/api/me/daily');
      if (r.done && r.result) setView({ name: 'result', mode: { kind: 'daily' }, result: r.result });
      else if (r.questions?.length) setView({ name: 'quiz', mode: { kind: 'daily' }, questions: r.questions });
      else toast(t.empty, 'err');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const startPractice = async (cat: string) => {
    setBusy(true);
    try {
      const r = await studentApi.get<{ questions: PracticeQuestion[] }>(`/api/me/practice${cat ? `?category=${encodeURIComponent(cat)}` : ''}`);
      setView({ name: 'quiz', mode: { kind: 'practice', category: cat }, questions: r.questions });
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (mode: Mode, answers: { id: number; choice: string }[]) => {
    const r =
      mode.kind === 'daily'
        ? await studentApi.post<PracticeResult>('/api/me/daily', { answers })
        : await studentApi.post<PracticeResult>('/api/me/practice', { answers, category: mode.category });
    setView({ name: 'result', mode, result: r });
    void load();
  };

  const home = () => setView({ name: 'home' });

  if (!me)
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-12 w-12 text-ordo-gold" />
      </div>
    );

  if (view.name === 'quiz') return <Quiz key={view.questions.map((q) => q.id).join()} mode={view.mode} questions={view.questions} onSubmit={submit} onExit={home} />;
  if (view.name === 'result')
    return (
      <Result
        result={view.result}
        mode={view.mode}
        onHome={home}
        onAgain={view.mode.kind === 'practice' ? () => startPractice((view.mode as { category: string }).category) : undefined}
      />
    );

  const accuracy = me.totals.answered ? Math.round((me.totals.correct / me.totals.answered) * 100) : 0;
  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-sm font-semibold transition ${on ? 'bg-ordo-gold text-ordo-night' : 'bg-white/10 text-white/80 hover:bg-white/20'}`;

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <Link to="/">
          <Logo size="sm" />
        </Link>
        <div className="flex items-center gap-2">
          <LangSwitch dark />
          <button className="rounded-lg px-3 py-1.5 text-sm font-bold text-white/70 ring-1 ring-white/20 hover:bg-white/10" onClick={onLogout}>
            {t.logout}
          </button>
        </div>
      </header>

      <section>
        <h1 className="font-display text-3xl font-black text-gold-gradient">{t.hello(me.student.name.split(' ')[0])}</h1>
        {me.student.className && <div className="text-ordo-sky-light">{me.student.className}</div>}
      </section>

      {/* Серия */}
      <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 rounded-3xl bg-gradient-to-br from-orange-500/25 to-ordo-red/20 p-5 ring-1 ring-orange-400/40">
        <Flame className={`h-14 w-14 shrink-0 ${me.streak ? 'text-orange-400' : 'text-white/30'}`} fill={me.streak ? 'currentColor' : 'none'} />
        <div className="flex-1">
          <div className={`font-display font-black ${me.streak ? 'text-3xl' : 'text-xl'}`}>{me.streak ? t.streak(me.streak) : t.streakZero}</div>
          {me.best > 0 && <div className="text-sm text-white/60">{t.best(me.best)}</div>}
        </div>
      </motion.section>

      {/* Күндүн суроолору */}
      <section className="rounded-3xl bg-white/[0.07] p-5 ring-1 ring-white/10">
        <h2 className="font-display text-xl font-bold"><Sun className="ico text-ordo-gold" /> {t.dailyTitle}</h2>
        {me.todayDone ? (
          <>
            <p className="mt-1 font-semibold text-emerald-300">{t.dailyDone}</p>
            <p className="text-sm text-white/60">{t.dailyComeBack}</p>
            <Button variant="outline" className="mt-4" loading={busy} onClick={startDaily}>
              {t.dailyReview}
            </Button>
          </>
        ) : (
          <>
            <p className="mt-1 text-white/70">{t.dailyHint(5)}</p>
            <Button variant="gold" size="lg" className="mt-4 w-full sm:w-auto" loading={busy} disabled={!me.libraryTotal} onClick={startDaily}>
              <Play className="ico" /> {t.dailyStart}
            </Button>
          </>
        )}
        {/* Акыркы 14 күн */}
        <div className="mt-5">
          <div className="mb-2 text-xs font-bold tracking-wide text-white/50 uppercase">{t.calendar}</div>
          <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-14">
            {me.calendar.map((d) => (
              <div
                key={d.day}
                title={d.done ? `${d.day}: ${d.correct}/${d.total}` : d.day}
                className={`flex aspect-square items-center justify-center rounded-lg text-xs font-bold ${
                  d.done ? 'bg-emerald-500 text-white' : d.day === me.today ? 'bg-white/5 text-white ring-2 ring-ordo-gold' : 'bg-white/5 text-white/40'
                }`}
              >
                {Number(d.day.slice(8))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Машыгуу */}
      <section className="rounded-3xl bg-white/[0.07] p-5 ring-1 ring-white/10">
        <h2 className="font-display text-xl font-bold"><Target className="ico text-ordo-sky-light" /> {t.practiceTitle}</h2>
        <p className="mt-1 text-white/70">{t.practiceHint}</p>
        {me.libraryTotal === 0 ? (
          <p className="mt-3 text-white/60">{t.empty}</p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className={chip(!category)} onClick={() => setCategory('')}>
                {t.allTopics}
              </button>
              {me.categories.map((c) => (
                <button key={c.name} className={chip(category === c.name)} onClick={() => setCategory(c.name)}>
                  {c.name}
                </button>
              ))}
            </div>
            <Button variant="sky" size="lg" className="mt-4 w-full sm:w-auto" loading={busy} onClick={() => startPractice(category)}>
              <Play className="ico" /> {t.practiceStart}
            </Button>
          </>
        )}
      </section>

      {/* Жыйынтыктар */}
      <section className="rounded-3xl bg-white/[0.07] p-5 ring-1 ring-white/10">
        <h2 className="font-display text-xl font-bold"><BarChart3 className="ico text-emerald-300" /> {t.stats}</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { label: t.statDays, value: me.totals.dailyDays },
            { label: t.statRuns, value: me.totals.practiceRuns },
            { label: t.statAccuracy, value: `${accuracy}%` },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-white/5 p-3">
              <div className="font-display text-2xl font-black text-ordo-gold-light">{s.value}</div>
              <div className="text-xs text-white/60">{s.label}</div>
            </div>
          ))}
        </div>
        {me.recentPractice.length > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="text-xs font-bold tracking-wide text-white/50 uppercase">{t.recent}</div>
            {me.recentPractice.map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm">
                <span>{p.category || t.allTopics}</span>
                <span className="text-white/50">{fmtDateTime(p.createdAt)}</span>
                <span className="font-bold text-ordo-gold-light">
                  {p.correct}/{p.total}
                </span>
              </div>
            ))}
          </div>
        )}
        <Link to={`/rating/student/${me.student.id}`} className="mt-4 inline-block font-semibold text-ordo-sky-light hover:underline">
          {t.profile}
        </Link>
      </section>
    </div>
  );
}

/** Суроолорду бирден көрсөтөт; жооптор аягында гана серверге жөнөтүлөт жана текшерилет */
function Quiz({
  mode,
  questions,
  onSubmit,
  onExit,
}: {
  mode: Mode;
  questions: PracticeQuestion[];
  onSubmit: (mode: Mode, answers: { id: number; choice: string }[]) => Promise<void>;
  onExit: () => void;
}) {
  const t = ky.student;
  const { confirm, toast } = useDialogs();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const q = questions[i];
  const choice = answers[q.id] ?? '';
  const last = i === questions.length - 1;
  const ready = q.type === 'ORDER' ? choice.length === 4 : !!choice;
  const setChoice = (c: string) => setAnswers((a) => ({ ...a, [q.id]: c }));

  const exit = async () => {
    if (Object.keys(answers).length && !(await confirm({ title: t.back, message: t.confirmLeave, confirmText: t.back }))) return;
    onExit();
  };

  const finish = async () => {
    setBusy(true);
    try {
      await onSubmit(
        mode,
        Object.entries(answers).map(([id, c]) => ({ id: Number(id), choice: c })),
      );
    } catch (e) {
      toast((e as Error).message, 'err');
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-18px)] max-w-2xl flex-col px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <button className="text-sm font-semibold text-white/60 hover:text-white" onClick={exit}>
          {t.back}
        </button>
        <div className="font-display font-bold text-ordo-gold-light">
          {mode.kind === 'daily' ? <><Sun className="ico" /> {t.dailyTitle}</> : <><Target className="ico" /> {mode.category || t.allTopics}</>}
        </div>
        <div className="font-display font-bold tabular-nums">{t.question(i + 1, questions.length)}</div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-ordo-gold to-orange-500" animate={{ width: `${((i + (ready ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={q.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="flex flex-1 flex-col gap-4 py-6">
          {q.category && <div className="text-sm font-semibold text-ordo-sky-light">#{q.category}</div>}
          <h2 className="font-display text-2xl leading-snug font-bold md:text-3xl">{q.text}</h2>
          {q.imageUrl && <img src={assetUrl(q.imageUrl)} alt="" className="max-h-56 w-full rounded-2xl object-contain" />}
          {q.audioUrl && <audio controls src={assetUrl(q.audioUrl)} className="w-full" />}

          {q.type === 'ORDER' ? (
            <div className="space-y-2">
              <div className="text-sm text-white/60">{t.orderHint}</div>
              {OPTION_KEYS.map((k) => {
                const pos = choice.indexOf(k);
                return (
                  <button
                    key={k}
                    disabled={pos >= 0}
                    onClick={() => setChoice(choice + k)}
                    className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left text-lg font-semibold transition ${pos >= 0 ? 'bg-emerald-500/20 ring-2 ring-emerald-400' : 'bg-white/10 hover:bg-white/15'}`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display font-black ${pos >= 0 ? 'bg-emerald-500' : OPTION_STYLE[k].bg}`}>
                      {pos >= 0 ? pos + 1 : ky.options[k]}
                    </span>
                    {q.options[k]}
                  </button>
                );
              })}
              {choice && (
                <button className="text-sm font-semibold text-ordo-sky-light" onClick={() => setChoice('')}>
                  ↺ {t.orderReset}
                </button>
              )}
            </div>
          ) : (
            <div className={`grid gap-3 ${q.type === 'TF' ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
              {optionKeysFor(q.type).map((k) => {
                const on = choice === k;
                const st = OPTION_STYLE[q.type === 'TF' ? (k === 'A' ? 'D' : 'A') : k];
                return (
                  <button
                    key={k}
                    onClick={() => setChoice(k)}
                    className={`flex items-center gap-3 rounded-2xl p-3 text-left text-lg font-semibold transition ${on ? 'bg-white/20 ring-4 ring-ordo-gold' : 'bg-white/10 hover:bg-white/15'}`}
                  >
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-xl font-black ${st.bg}`}>
                      {q.type === 'TF' ? (k === 'A' ? '✓' : '✗') : ky.options[k]}
                    </span>
                    {q.type === 'TF' ? ky.tf[k] : q.options[k]}
                  </button>
                );
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="sticky bottom-3">
        {last ? (
          <Button variant="green" size="lg" className="w-full" loading={busy} disabled={!ready} onClick={finish}>
            {t.finish}
          </Button>
        ) : (
          <Button variant="gold" size="lg" className="w-full" disabled={!ready} onClick={() => setI(i + 1)}>
            {t.next}
          </Button>
        )}
      </div>
    </div>
  );
}

function Result({ result, mode, onHome, onAgain }: { result: PracticeResult; mode: Mode; onHome: () => void; onAgain?: () => void }) {
  const t = ky.student;
  const ratio = result.total ? result.correct / result.total : 0;
  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
      <motion.section initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-3xl bg-white/[0.07] p-6 text-center ring-1 ring-white/10">
        <div className="text-6xl text-ordo-gold">{ratio === 1 ? <Trophy className="ico mx-auto" /> : ratio >= 0.6 ? <PartyPopper className="ico mx-auto" /> : <Dumbbell className="ico mx-auto" />}</div>
        <div className="mt-2 font-display text-4xl font-black text-gold-gradient">
          {result.correct} / {result.total}
        </div>
        <div className="mt-1 text-lg">{t.result(result.correct, result.total)}</div>
        <div className="mt-1 text-white/70">{ratio === 1 ? t.perfect : ratio >= 0.6 ? t.good : t.tryMore}</div>
        {mode.kind === 'daily' && result.streak !== undefined && result.streak > 0 && <div className="mt-3 font-display text-xl font-bold text-orange-300"><Flame className="ico" /> {t.streak(result.streak)}</div>}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="outline" onClick={onHome}>
            {t.back}
          </Button>
          {onAgain && (
            <Button variant="sky" onClick={onAgain}>
              <Target className="ico" /> {t.again}
            </Button>
          )}
        </div>
      </motion.section>

      <div className="space-y-2">
        {result.items.map((it, n) => (
          <div key={it.id} className={`rounded-2xl p-4 ring-1 ${it.isCorrect ? 'bg-emerald-500/10 ring-emerald-400/40' : 'bg-ordo-red/10 ring-ordo-red/40'}`}>
            <div className="flex gap-2 font-semibold">
              <span className="shrink-0 pt-0.5">{it.isCorrect ? <CircleCheckBig className="h-5 w-5 text-emerald-400" /> : <CircleX className="h-5 w-5 text-red-400" />}</span>
              <span>
                {n + 1}. {it.text}
              </span>
            </div>
            <div className="mt-2 space-y-0.5 pl-7 text-sm">
              {!it.isCorrect && (
                <div className="text-white/70">
                  {t.yourAnswer}: <span className="font-semibold text-red-300">{it.choice ? answerText(it.type, it.choice, it.options) : t.noAnswer}</span>
                </div>
              )}
              <div className="text-white/70">
                {t.correctAnswer}: <span className="font-semibold text-emerald-300">{answerText(it.type, it.correct, it.options)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
