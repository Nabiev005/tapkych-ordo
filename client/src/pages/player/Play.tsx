import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { OPTION_STYLE } from '../../components/game';
import { OrnamentBand, SunTunduk } from '../../components/Ornament';
import { Button, ConnBadge, Spinner, useDialogs } from '../../components/ui';
import { ky, type OptionKey, type RoundKey } from '../../i18n/ky';
import { vibrate } from '../../lib/sound';
import { assetUrl } from '../../lib/api';
import { answerText, asOption } from '../../lib/questions';
import { OPTION_KEYS, optionKeysFor, type PlayerState } from '../../lib/types';
import { useCountdown, useGameSocket } from '../../lib/useGameSocket';
import type { PlayerSession } from './Join';

type Emit = (e: string, p: unknown) => Promise<void>;
type Toast = (s: string, k?: 'ok' | 'err') => void;

export default function Play({ session, onLeave }: { session: PlayerSession; onLeave: (msg?: string) => void }) {
  const t = ky.player;
  const { toast } = useDialogs();
  const [ended, setEnded] = useState<null | 'kicked' | 'replaced' | 'deleted'>(null);
  const { state, status, offset, emit } = useGameSocket<PlayerState>(ended ? null : { role: 'player', token: session.token }, {
    'player:kicked': () => setEnded('kicked'),
    'session:replaced': () => setEnded('replaced'),
    'game:deleted': () => setEnded('deleted'),
  });

  // Токен жараксыз (мис. PIN жаңыланган) — кайра кирүү формасына
  useEffect(() => {
    if (status === 'denied' && !ended) onLeave(ky.errors.UNAUTHORIZED);
  }, [status, ended, onLeave]);

  if (ended)
    return (
      <Shell>
        <div className="text-6xl">{ended === 'replaced' ? '📱' : '⛔'}</div>
        <p className="max-w-sm text-xl font-semibold">{ended === 'kicked' ? t.kicked : ended === 'replaced' ? t.replaced : t.gameDeleted}</p>
        <Button variant="gold" size="lg" onClick={() => onLeave()}>
          {ended === 'replaced' ? t.rejoin : t.leave}
        </Button>
      </Shell>
    );

  if (!state)
    return (
      <Shell>
        <Spinner className="h-12 w-12 text-ordo-gold" />
        <div className="text-white/60">{ky.common.connecting}</div>
      </Shell>
    );

  return (
    <>
      <PlayView state={state} offset={offset} emit={emit} toast={toast} />
      <ConnBadge status={status} dark />
    </>
  );
}

function Shell({ children, name }: { children: ReactNode; name?: string }) {
  return (
    <div className="bg-night flex min-h-dvh flex-col text-white">
      <OrnamentBand height={16} />
      {name && <div className="px-5 pt-3 text-center text-sm font-semibold text-white/50">👤 {name}</div>}
      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">{children}</div>
      <OrnamentBand height={16} flip />
    </div>
  );
}

function PlayView({ state, offset, emit, toast }: { state: PlayerState; offset: number; emit: Emit; toast: Toast }) {
  const t = ky.player;
  const g = state.game;
  const me = state.me;
  const q = state.question;
  const round = g.round as RoundKey | null;

  if (!me) return null;

  if (g.status === 'LOBBY')
    return (
      <Shell>
        <SunTunduk size={130} />
        <h1 className="font-display text-3xl font-black text-gold-gradient">{t.hello(me.name)}</h1>
        {me.team && g.teamMode && <div className="rounded-full bg-white/10 px-4 py-1 font-semibold text-ordo-sky-light">🏫 {me.team}</div>}
        <motion.div animate={{ opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 2 }} className="font-display text-xl font-bold">
          {t.waitingTitle}
        </motion.div>
        <p className="max-w-xs text-white/60">{t.waitingHint}</p>
      </Shell>
    );

  if (g.status === 'FINISHED') return <Finished state={state} />;

  if (!state.inRound)
    return (
      <Shell name={me.name}>
        <div className="text-6xl">👀</div>
        <p className="max-w-sm text-xl font-semibold leading-relaxed">{t.eliminated}</p>
        <p className="text-white/60">{t.eliminatedHint}</p>
        {round && (
          <div className="rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/70">
            {t.spectating} · {ky.rounds[round]}
            {g.index >= 0 ? ` · ${g.index + 1}/${g.total}` : ''}
          </div>
        )}
        {/* Турдан чыккандар залдагы көрүүчү катары добуш бере алат */}
        <Link to={`/watch/${g.code}`} className="rounded-2xl bg-violet-600 px-6 py-3 font-semibold shadow-lg hover:bg-violet-500">
          👥 {t.watchAsAudience}
        </Link>
      </Shell>
    );

  if (g.paused && g.phase !== 'QUESTION')
    return (
      <Shell name={me.name}>
        <div className="text-7xl">⏸</div>
        <div className="font-display text-3xl font-black">{t.paused}</div>
        <p className="text-white/60">{t.pausedHint}</p>
      </Shell>
    );

  if (g.phase === 'IDLE' && round)
    return (
      <Shell name={me.name}>
        {round !== 'ROUND1' && !g.teamMode && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-6xl">
            🎉
          </motion.div>
        )}
        {round !== 'ROUND1' && !g.teamMode && <div className="max-w-sm font-display text-2xl font-bold text-ordo-gold-light">{t.advanced(round)}</div>}
        <div className="font-display text-4xl font-black text-gold-gradient">{ky.roundsUpper[round]}</div>
        <p className="text-white/60">{t.roundStarting(round)}</p>
      </Shell>
    );

  if (g.phase === 'READY' && q)
    return (
      <Shell name={me.name}>
        <div className="font-display text-xl text-white/60">{t.questionNo(q.number, g.total)}</div>
        <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} className="font-display text-3xl font-black text-ordo-gold">
          {t.getReady}
        </motion.div>
      </Shell>
    );

  if (g.phase === 'QUESTION' && q) return <AnswerPad key={q.number} state={state} offset={offset} emit={emit} toast={toast} />;

  if (g.phase === 'REVEAL' && q) return <RevealView state={state} />;

  if (g.phase === 'ROUND_END')
    return (
      <Shell name={me.name}>
        <div className="text-6xl">🏁</div>
        <div className="font-display text-3xl font-black">{t.roundEnd}</div>
        <ScoreLine state={state} />
        <motion.p animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2 }} className="text-white/60">
          {t.roundEndHint}
        </motion.p>
      </Shell>
    );

  return <Shell name={me.name}>…</Shell>;
}

function ScoreLine({ state }: { state: PlayerState }) {
  const t = ky.player;
  return (
    <div className="space-y-1">
      <div className="font-display text-2xl font-bold">{t.roundScore(state.roundScore)}</div>
      {state.roundRank && <div className="text-white/60">{t.rank(state.roundRank, state.roundPlayers)}</div>}
    </div>
  );
}

function AnswerPad({ state, offset, emit, toast }: { state: PlayerState; offset: number; emit: Emit; toast: Toast }) {
  const t = ky.player;
  const g = state.game;
  const q = state.question!;
  const msLeft = useCountdown(g.endsAt, offset, g.pausedRemainingMs);
  const [pending, setPending] = useState<string | null>(null);
  const [order, setOrder] = useState('');
  const [fiftyBusy, setFiftyBusy] = useState(false);
  const choice = q.myChoice ?? pending;
  const locked = !!choice || msLeft <= 0 || g.paused;
  const frac = Math.max(0, Math.min(1, msLeft / (g.timerSeconds * 1000)));
  const canFifty = state.fiftyAvailable && q.type === 'CHOICE' && !locked && q.hidden.length === 0;

  const answer = async (value: string) => {
    if (locked) return;
    setPending(value);
    vibrate(40);
    try {
      await emit('player:answer', { choice: value });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg !== ky.errors.ALREADY_ANSWERED) setPending(null);
      toast(msg, 'err');
    }
  };

  const fifty = async () => {
    setFiftyBusy(true);
    try {
      await emit('player:fifty', {});
      vibrate([30, 30, 30]);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setFiftyBusy(false);
    }
  };

  const keys = optionKeysFor(q.type).filter((k) => !q.hidden.includes(k));

  return (
    <div className="bg-night flex min-h-dvh flex-col p-4 text-white">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="font-display text-lg font-bold">{t.questionNo(q.number, g.total)}</div>
        {canFifty && (
          <button
            onClick={fifty}
            disabled={fiftyBusy}
            title={t.fiftyHint}
            className="rounded-full bg-gradient-to-b from-ordo-gold-light to-ordo-gold px-4 py-1.5 font-display font-black text-ordo-night shadow-lg disabled:opacity-50"
          >
            {t.fifty}
          </button>
        )}
        {q.hidden.length > 0 && <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">{t.fiftyUsedNote}</span>}
        <div className={`font-display text-3xl font-black tabular-nums ${msLeft <= 5000 && msLeft > 0 ? 'text-opt-a' : ''}`}>{g.paused ? '⏸' : Math.ceil(msLeft / 1000)}</div>
      </div>
      <div className="mb-4 h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-100 ease-linear"
          style={{ width: `${frac * 100}%`, background: frac > 0.5 ? '#1ba4e3' : frac > 0.33 ? '#f5b700' : '#e11d48' }}
        />
      </div>

      {/* Суроонун тексти — телефондо да көрүнөт */}
      {q.text && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 rounded-3xl bg-white/[0.08] p-4 ring-1 ring-white/10">
          {q.imageUrl && <img src={assetUrl(q.imageUrl)} alt="" className="mb-3 max-h-44 w-full rounded-2xl object-contain" />}
          <div className="text-xl font-semibold leading-snug">{q.text}</div>
          {q.audioUrl && (
            <div className="mt-3">
              <div className="mb-1 text-sm text-white/60">🎵 {t.listen}</div>
              <audio controls src={assetUrl(q.audioUrl)} className="w-full" />
            </div>
          )}
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {choice ? (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            {asOption(choice) && q.type === 'CHOICE' ? (
              <div className={`flex h-32 w-32 items-center justify-center rounded-[2rem] font-display text-7xl font-black text-white shadow-2xl ${OPTION_STYLE[asOption(choice)!].bg} ${OPTION_STYLE[asOption(choice)!].glow}`}>
                {ky.options[asOption(choice)!]}
              </div>
            ) : (
              <div className="text-7xl">✓</div>
            )}
            <div className="max-w-sm text-2xl font-semibold">{q.type === 'CHOICE' ? q.options?.[choice as OptionKey] : answerText(q.type, choice, q.options)}</div>
            <div className="font-display text-2xl font-bold">✓ {t.answered}</div>
            <div className="text-white/60">{t.waitReveal}</div>
            <div className="text-sm text-white/40">🔒 {t.alreadyAnswered}</div>
          </motion.div>
        ) : msLeft <= 0 ? (
          <motion.div key="up" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <div className="text-7xl">⌛</div>
            <div className="font-display text-3xl font-black">{t.timeUp}</div>
            <div className="text-white/60">{t.noAnswer}</div>
          </motion.div>
        ) : q.type === 'TF' ? (
          // Туура / Туура эмес — эки чоң баскыч
          <motion.div key="tf" className="flex flex-1 flex-col gap-3">
            <div className="text-center text-white/60">{t.lookAtScreen}</div>
            {(['A', 'B'] as const).map((k) => (
              <motion.button
                key={k}
                whileTap={{ scale: 0.95 }}
                disabled={locked}
                onClick={() => answer(k)}
                className={`flex flex-1 items-center justify-center gap-3 rounded-[2rem] font-display text-4xl font-black text-white shadow-[0_8px_0_rgba(0,0,0,0.35)] active:shadow-none disabled:opacity-40 ${k === 'A' ? 'bg-emerald-500' : 'bg-opt-a'}`}
              >
                {k === 'A' ? '✓' : '✗'} {ky.tf[k]}
              </motion.button>
            ))}
          </motion.div>
        ) : q.type === 'ORDER' && q.options ? (
          // Иретке келтирүү: элементтерди кезеги менен басуу
          <motion.div key="order" className="flex flex-1 flex-col gap-3">
            <div className="text-center text-white/60">{t.orderHint}</div>
            {OPTION_KEYS.map((k) => {
              const pos = order.indexOf(k);
              return (
                <motion.button
                  key={k}
                  whileTap={{ scale: 0.97 }}
                  disabled={pos >= 0}
                  onClick={() => setOrder((o) => (o.includes(k) || o.length >= 4 ? o : o + k))}
                  className={`flex min-h-16 items-center gap-4 rounded-3xl px-4 py-3 text-left text-white shadow-[0_6px_0_rgba(0,0,0,0.35)] ${pos >= 0 ? 'bg-white/15 shadow-none' : OPTION_STYLE[k].bg}`}
                >
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-display text-3xl font-black ${pos >= 0 ? 'bg-emerald-500' : 'bg-black/20'}`}>
                    {pos >= 0 ? pos + 1 : '·'}
                  </span>
                  <span className="text-xl font-bold leading-tight">{q.options![k]}</span>
                </motion.button>
              );
            })}
            <div className="mt-1 grid grid-cols-2 gap-3">
              <Button variant="dark" size="lg" disabled={!order} onClick={() => setOrder('')}>
                ↺ {t.orderReset}
              </Button>
              <Button variant="gold" size="lg" disabled={order.length !== 4} onClick={() => answer(order)}>
                {t.orderSubmit} →
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="pad" className="flex flex-1 flex-col">
            <div className="mb-3 text-center text-white/60">{t.lookAtScreen}</div>
            {q.options ? (
              // Варианттардын тексти менен — бирден сапка, чоң баскычтар
              <div className="flex flex-1 flex-col gap-3">
                {keys.map((k, i) => (
                  <motion.button
                    key={k}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileTap={{ scale: 0.96 }}
                    disabled={locked}
                    onClick={() => answer(k)}
                    className={`flex min-h-20 flex-1 items-center gap-4 rounded-3xl px-4 py-3 text-left text-white shadow-[0_6px_0_rgba(0,0,0,0.35)] active:shadow-none disabled:opacity-40 ${OPTION_STYLE[k].bg}`}
                  >
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-black/20 font-display text-4xl font-black">{ky.options[k]}</span>
                    <span className="text-xl font-bold leading-tight">{q.options![k]}</span>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="grid flex-1 grid-cols-2 gap-3">
                {keys.map((k, i) => (
                  <motion.button
                    key={k}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    whileTap={{ scale: 0.92 }}
                    disabled={locked}
                    onClick={() => answer(k)}
                    className={`flex min-h-36 items-center justify-center rounded-[2rem] font-display text-8xl font-black text-white shadow-[0_8px_0_rgba(0,0,0,0.35)] active:shadow-none disabled:opacity-40 ${OPTION_STYLE[k].bg}`}
                  >
                    {ky.options[k]}
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RevealView({ state }: { state: PlayerState }) {
  const t = ky.player;
  const q = state.question!;
  const ok = !!q.myCorrect;
  useEffect(() => {
    vibrate(ok ? [60, 40, 60] : 300);
  }, [ok]);
  const correctKey = asOption(q.correct);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-center text-white ${ok ? 'bg-gradient-to-b from-emerald-500 to-emerald-800' : 'bg-gradient-to-b from-[#e0213f] to-[#6e0818]'}`}
    >
      <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', damping: 10 }} className="text-9xl">
        {ok ? '✓' : '✗'}
      </motion.div>
      <div className="font-display text-5xl font-black">{ok ? t.correct : t.wrong}</div>
      {ok && q.myPoints ? <div className="font-display text-3xl font-bold text-ordo-gold-light">{t.plusPoints(q.myPoints)}</div> : null}
      {ok && q.myBonus ? <div className="rounded-full bg-black/20 px-4 py-1 font-bold text-ordo-gold-light">{t.bonus(q.myBonus)}</div> : null}
      {!q.myChoice && <div className="text-xl text-white/80">{t.noAnswer}</div>}
      {q.text && <div className="max-w-sm text-lg text-white/80">{q.text}</div>}
      {q.correct && (
        <div className="flex max-w-sm items-center gap-3 rounded-2xl bg-black/20 px-5 py-3 text-left text-xl">
          <span className="shrink-0">{t.correctWas('')}</span>
          {q.type === 'CHOICE' && correctKey ? (
            <>
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-display text-2xl font-black ${OPTION_STYLE[correctKey].bg}`}>{ky.options[correctKey]}</span>
              {q.options && <span className="font-bold">{q.options[correctKey]}</span>}
            </>
          ) : (
            <span className="font-bold">{answerText(q.type, q.correct, q.options)}</span>
          )}
        </div>
      )}
      {q.type === 'ORDER' && q.myChoice && !ok && (
        <div className="max-w-sm text-sm text-white/70">
          {t.orderYour}: {answerText('ORDER', q.myChoice, q.options)}
        </div>
      )}
      <ScoreLine state={state} />
    </motion.div>
  );
}

function Finished({ state }: { state: PlayerState }) {
  const t = ky.player;
  const f = state.final;
  const team = state.teamFinal;
  const winner = state.game.teamMode ? team?.place === 1 : f?.place === 1;
  useEffect(() => {
    const top = state.game.teamMode ? (team?.place ?? 99) <= 1 : (f?.place ?? 99) <= 3;
    if (top) {
      const end = Date.now() + (winner ? 4000 : 1500);
      const tick = () => {
        confetti({ particleCount: 6, spread: 70, origin: { y: 0.7 }, colors: ['#c8102e', '#f5b700', '#1ba4e3'] });
        if (Date.now() < end) requestAnimationFrame(tick);
      };
      tick();
    }
  }, [f, team, winner, state.game.teamMode]);
  return (
    <Shell name={state.me?.name}>
      <div className="text-7xl">{winner ? '👑' : f && f.place <= 3 ? ['🥇', '🥈', '🥉'][f.place - 1] : '🎖'}</div>
      <div className="font-display text-3xl font-black text-gold-gradient">{winner && !state.game.teamMode ? t.winner : t.finishedTitle}</div>
      {team && <div className="rounded-2xl bg-white/10 px-5 py-3 font-display text-xl font-bold text-ordo-gold-light">🏫 {t.teamPlace(team.team, team.place)}</div>}
      {f && (
        <>
          <div className="font-display text-2xl font-bold">{t.yourPlace(f.place)}</div>
          <div className="w-full max-w-xs space-y-2 rounded-3xl bg-white/10 p-5">
            {(['ROUND1', 'ROUND2', 'FINAL'] as RoundKey[]).map((r) =>
              f.rounds[r] ? (
                <div key={r} className="flex justify-between text-lg">
                  <span className="text-white/70">{ky.rounds[r]}</span>
                  <span className="font-bold">{ky.common.points(f.rounds[r]!.score)}</span>
                </div>
              ) : null,
            )}
            <div className="flex justify-between border-t border-white/20 pt-2 text-xl font-black">
              <span>{ky.screen.total}</span>
              <span className="text-ordo-gold">{ky.common.points(f.total)}</span>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}
