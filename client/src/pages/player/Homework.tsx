import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { OPTION_STYLE } from '../../components/game';
import { Logo, OrnamentBand } from '../../components/Ornament';
import { LangSwitch } from '../../components/LangSwitch';
import { Button, FullCenter, Spinner, useDialogs } from '../../components/ui';
import { fmtDateTime, ky, type OptionKey, type QuestionType } from '../../i18n/ky';
import { api, assetUrl } from '../../lib/api';
import { answerText } from '../../lib/questions';
import { vibrate } from '../../lib/sound';
import { OPTION_KEYS, optionKeysFor, type Options, type Student } from '../../lib/types';

interface Info {
  assignment: { title: string; questions: number; timerSeconds: number; open: boolean; closesAt: string | null };
  students: Student[];
}
interface Session {
  title: string;
  name: string;
  index: number;
  total: number;
  timerSeconds: number;
  serverNow: number;
  finished: boolean;
  question?: { number: number; type: QuestionType; category: string; text: string; imageUrl: string | null; audioUrl: string | null; options: Options; deadline: number | null } | null;
  result?: { score: number; correct: number; review: { text: string; type: QuestionType; options: Options; correct: string; choice: string | null; isCorrect: boolean }[] };
}

const tokenKey = (code: string) => `ordo_hw_${code}`;
const store = {
  get: (code: string) => {
    try {
      return localStorage.getItem(tokenKey(code));
    } catch {
      return null;
    }
  },
  set: (code: string, v: string) => {
    try {
      localStorage.setItem(tokenKey(code), v);
    } catch {
      /* жеке режим */
    }
  },
  clear: (code: string) => {
    try {
      localStorage.removeItem(tokenKey(code));
    } catch {
      /* жеке режим */
    }
  },
};

/** Үй тапшырмасы — студенттин бети */
export default function Homework() {
  const t = ky.homework;
  const { code = '' } = useParams();
  const { toast } = useDialogs();
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState('');
  const [token, setToken] = useState<string | null>(() => store.get(code));
  const [cls, setCls] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<Info>(`/api/hw/${code}`)
      .then(setInfo)
      .catch(() => setError(t.notFound));
  }, [code]);

  const classes = useMemo(() => [...new Set((info?.students ?? []).map((s) => s.className))].sort((a, b) => a.localeCompare(b, 'ky', { numeric: true })), [info]);

  if (token) return <Session code={code} token={token} onReset={() => (store.clear(code), setToken(null))} />;

  if (error)
    return (
      <FullCenter>
        <Logo size="md" />
        <p className="mt-6 text-xl text-white/70">{error}</p>
      </FullCenter>
    );
  if (!info)
    return (
      <FullCenter>
        <Spinner className="h-12 w-12 text-ordo-gold" />
      </FullCenter>
    );

  const a = info.assignment;
  const start = async (studentId: number) => {
    setBusy(true);
    try {
      const r = await api.post<{ token: string }>(`/api/hw/${code}/start`, { studentId });
      store.set(code, r.token);
      setToken(r.token);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const students = info.students.filter(
    (s) => (cls === null || s.className === cls) && (!query || s.name.toLocaleLowerCase('ky').includes(query.toLocaleLowerCase('ky'))),
  );

  return (
    <div className="bg-night flex min-h-dvh flex-col text-white">
      <OrnamentBand height={16} />
      <div className="mx-auto w-full max-w-md flex-1 space-y-5 p-5">
        <div className="flex justify-end">
          <LangSwitch dark />
        </div>
        <div className="flex justify-center">
          <Logo size="md" />
        </div>
        <div className="rounded-3xl bg-white/[0.07] p-5 text-center ring-1 ring-white/10">
          <div className="text-sm uppercase tracking-widest text-ordo-sky-light">📝 {t.title}</div>
          <h1 className="mt-1 font-display text-2xl font-black">{a.title}</h1>
          <div className="mt-1 text-white/70">{t.questions(a.questions, a.timerSeconds)}</div>
          {a.closesAt && <div className="mt-1 text-sm text-ordo-gold-light">{t.closesAt(fmtDateTime(a.closesAt))}</div>}
        </div>

        {!a.open ? (
          <div className="rounded-2xl bg-ordo-red p-4 text-center font-semibold">{t.closed}</div>
        ) : (
          <>
            <p className="rounded-2xl bg-white/5 p-3 text-sm text-white/70">ℹ️ {t.rules}</p>
            <div>
              <div className="mb-2 font-semibold">{t.pickClass}</div>
              <div className="flex flex-wrap gap-2">
                {classes.map((c) => (
                  <button key={c || 'none'} onClick={() => setCls(c)} className={`rounded-full px-4 py-2 font-semibold ${cls === c ? 'bg-ordo-gold text-ordo-night' : 'bg-white/10'}`}>
                    {c || ky.admin.students.noClass}
                  </button>
                ))}
              </div>
            </div>
            {cls !== null && (
              <div>
                <div className="mb-2 font-semibold">{t.pickName}</div>
                <input className="mb-2 w-full rounded-2xl bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40" placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
                <div className="space-y-2">
                  {students.map((s) => (
                    <button
                      key={s.id}
                      disabled={busy}
                      onClick={() => start(s.id)}
                      className="flex w-full items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-left font-semibold hover:bg-white/20 disabled:opacity-50"
                    >
                      {s.name}
                      <span className="text-ordo-gold">{t.start} →</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <OrnamentBand height={16} flip />
    </div>
  );
}

function Session({ code, token, onReset }: { code: string; token: string; onReset: () => void }) {
  const t = ky.homework;
  const { toast } = useDialogs();
  const [s, setS] = useState<Session | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [order, setOrder] = useState('');
  const [sending, setSending] = useState(false);

  const apply = (x: Session) => {
    setOffset(x.serverNow - Date.now());
    setS(x);
    setOrder('');
  };
  const load = useCallback(() => {
    api
      .get<Session>(`/api/hw/session/${token}`)
      .then(apply)
      .catch(() => onReset());
  }, [token]);
  useEffect(load, [load]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const deadline = s?.question?.deadline ?? null;
  const msLeft = deadline ? Math.max(0, deadline - (now + offset)) : 0;
  // Убакыт бүттү — сервер кийинки суроого өткөрөт
  useEffect(() => {
    if (s && !s.finished && deadline && msLeft === 0) {
      const id = setTimeout(load, 1700);
      return () => clearTimeout(id);
    }
  }, [msLeft === 0, s?.index]);

  if (!s)
    return (
      <FullCenter>
        <Spinner className="h-12 w-12 text-ordo-gold" />
      </FullCenter>
    );

  const answer = async (choice: string) => {
    if (!s.question || sending) return;
    setSending(true);
    vibrate(30);
    try {
      apply(await api.post<Session>(`/api/hw/session/${token}/answer`, { number: s.question.number, choice }));
    } catch (e) {
      toast((e as Error).message, 'err');
      load();
    } finally {
      setSending(false);
    }
  };

  if (s.finished && s.result) {
    const r = s.result;
    return (
      <div className="bg-night min-h-dvh text-white">
        <OrnamentBand height={16} />
        <div className="mx-auto max-w-lg space-y-5 p-5">
          <div className="text-center">
            <div className="text-7xl">{r.correct === s.total ? '🏆' : r.correct >= s.total / 2 ? '🎉' : '📘'}</div>
            <h1 className="mt-2 font-display text-3xl font-black text-gold-gradient">{t.finished}</h1>
            <div className="mt-1 text-white/70">
              {s.name} · {s.title}
            </div>
            <div className="mt-3 font-display text-5xl font-black">{t.score(r.correct, s.total)}</div>
          </div>
          <h2 className="font-display text-lg font-bold">{t.review}</h2>
          <div className="space-y-2">
            {r.review.map((x, i) => (
              <div key={i} className={`rounded-2xl p-4 ${x.isCorrect ? 'bg-emerald-500/15 ring-1 ring-emerald-400/40' : 'bg-opt-a/15 ring-1 ring-opt-a/40'}`}>
                <div className="font-semibold">
                  {i + 1}. {x.text}
                </div>
                <div className="mt-1 text-sm">
                  {x.isCorrect ? '✓' : '✗'} {t.yourAnswer}: {x.choice ? answerText(x.type, x.choice, x.options) : t.noAnswer}
                </div>
                {!x.isCorrect && (
                  <div className="text-sm text-emerald-300">
                    ✓ {t.correctAnswer}: {answerText(x.type, x.correct, x.options)}
                  </div>
                )}
              </div>
            ))}
          </div>
          <button onClick={onReset} className="w-full text-center text-sm text-white/40 underline">
            {t.notMe}
          </button>
        </div>
        <OrnamentBand height={16} flip />
      </div>
    );
  }

  const q = s.question;
  if (!q)
    return (
      <FullCenter>
        <Spinner className="h-12 w-12 text-ordo-gold" />
      </FullCenter>
    );
  const frac = Math.min(1, msLeft / (s.timerSeconds * 1000));

  return (
    <div className="bg-night flex min-h-dvh flex-col p-4 text-white">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-display font-bold">{t.questionNo(q.number, s.total)}</div>
        <div className={`font-display text-3xl font-black tabular-nums ${msLeft <= 5000 ? 'text-opt-a' : ''}`}>{Math.ceil(msLeft / 1000)}</div>
      </div>
      <div className="mb-4 h-3 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-[width] duration-200 ease-linear" style={{ width: `${frac * 100}%`, background: frac > 0.5 ? '#1ba4e3' : frac > 0.33 ? '#f5b700' : '#e11d48' }} />
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={q.number} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="flex flex-1 flex-col gap-3">
          <div className="rounded-3xl bg-white/[0.08] p-4 ring-1 ring-white/10">
            {q.imageUrl && <img src={assetUrl(q.imageUrl)} alt="" className="mb-3 max-h-48 w-full rounded-2xl object-contain" />}
            <div className="text-xl font-semibold">{q.text}</div>
            {q.audioUrl && <audio controls autoPlay src={assetUrl(q.audioUrl)} className="mt-3 w-full" />}
          </div>
          {msLeft === 0 ? (
            <div className="flex flex-1 items-center justify-center text-center font-display text-xl">{t.timeUp}</div>
          ) : q.type === 'ORDER' ? (
            <>
              {OPTION_KEYS.map((k) => {
                const pos = order.indexOf(k);
                return (
                  <button
                    key={k}
                    disabled={pos >= 0}
                    onClick={() => setOrder((o) => (o.length < 4 && !o.includes(k) ? o + k : o))}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left font-semibold ${pos >= 0 ? 'bg-white/15' : OPTION_STYLE[k].bg}`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-2xl font-black ${pos >= 0 ? 'bg-emerald-500' : 'bg-black/20'}`}>{pos >= 0 ? pos + 1 : '·'}</span>
                    {q.options[k]}
                  </button>
                );
              })}
              <div className="grid grid-cols-2 gap-3">
                <Button variant="dark" size="lg" disabled={!order} onClick={() => setOrder('')}>
                  ↺ {ky.player.orderReset}
                </Button>
                <Button variant="gold" size="lg" disabled={order.length !== 4} loading={sending} onClick={() => answer(order)}>
                  {ky.player.orderSubmit} →
                </Button>
              </div>
            </>
          ) : (
            optionKeysFor(q.type).map((k) => (
              <motion.button
                key={k}
                whileTap={{ scale: 0.96 }}
                disabled={sending}
                onClick={() => answer(k)}
                className={`flex min-h-16 items-center gap-4 rounded-3xl px-4 py-3 text-left font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.35)] disabled:opacity-50 ${
                  q.type === 'TF' ? (k === 'A' ? 'bg-emerald-500' : 'bg-opt-a') : OPTION_STYLE[k as OptionKey].bg
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black/20 font-display text-2xl font-black">
                  {q.type === 'TF' ? (k === 'A' ? '✓' : '✗') : ky.options[k]}
                </span>
                <span className="text-lg">{q.type === 'TF' ? ky.tf[k] : q.options[k]}</span>
              </motion.button>
            ))
          )}
        </motion.div>
      </AnimatePresence>
      <div className="mt-3 text-center text-xs text-white/40">
        {s.name} · {code}
      </div>
    </div>
  );
}
