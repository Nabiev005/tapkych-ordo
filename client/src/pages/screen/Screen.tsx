import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { JoinQr, LeaderboardList, OptionCard, Podium, RingTimer } from '../../components/game';
import { CornerOrnament, HornMotif, Logo, OrnamentBand, SunTunduk } from '../../components/Ornament';
import { ConnBadge, FullCenter, Spinner } from '../../components/ui';
import { ky, type RoundKey } from '../../i18n/ky';
import { assetUrl, getJoinBase } from '../../lib/api';
import { audioUnlocked, setSoundEnabled, sfx, unlockAudio } from '../../lib/sound';
import { OPTION_KEYS, type ScreenState } from '../../lib/types';
import { useCountdown, useGameSocket } from '../../lib/useGameSocket';

const COLORS = ['#c8102e', '#f5b700', '#1ba4e3', '#ffffff'];

function burst(big = false) {
  const end = Date.now() + (big ? 5000 : 1800);
  const tick = () => {
    confetti({ particleCount: big ? 10 : 6, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors: COLORS });
    confetti({ particleCount: big ? 10 : 6, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors: COLORS });
    if (Date.now() < end) requestAnimationFrame(tick);
  };
  tick();
}

export default function Screen() {
  const { code = '' } = useParams();
  const [deleted, setDeleted] = useState(false);
  const { state, status, offset } = useGameSocket<ScreenState>(deleted ? null : { role: 'screen', code }, {
    'game:deleted': () => setDeleted(true),
  });
  const [audioOk, setAudioOk] = useState(audioUnlocked());

  useEffect(() => {
    if (state) setSoundEnabled(state.game.soundEnabled);
  }, [state?.game.soundEnabled]);

  if (deleted || status === 'denied')
    return (
      <FullCenter>
        <Logo size="lg" />
        <div className="mt-8 text-3xl text-white/70">{ky.screen.notFound}</div>
      </FullCenter>
    );
  if (!state)
    return (
      <FullCenter>
        <Spinner className="h-16 w-16 text-ordo-gold" />
      </FullCenter>
    );

  return (
    <div
      className="bg-night relative flex h-dvh flex-col overflow-hidden text-white"
      onClick={() => {
        if (!audioOk) setAudioOk(unlockAudio());
      }}
    >
      <Backdrop />
      <OrnamentBand height={26} />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <Stage state={state} offset={offset} />
      </div>
      <OrnamentBand height={26} flip />

      <AnimatePresence>
        {state.game.paused && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-ordo-deep/90 backdrop-blur">
            <SunTunduk size={200} />
            <div className="font-display text-8xl font-black tracking-widest text-gold-gradient">{ky.screen.paused}</div>
            <div className="text-3xl text-white/60">{ky.screen.pausedHint}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {!audioOk && state.game.soundEnabled && (
        <div className="absolute right-6 top-10 z-50 animate-pulse rounded-full bg-white/10 px-5 py-2 text-lg text-white/70">🔈 {ky.screen.enableSound}</div>
      )}
      <ConnBadge status={status} dark />
      <SoundDirector state={state} offset={offset} />
    </div>
  );
}

/** Фондогу оюулар */
function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <HornMotif className="absolute -left-20 top-1/4 w-96 text-ordo-gold/[0.06]" width={3} />
      <HornMotif className="absolute -right-20 bottom-1/4 w-96 rotate-180 text-ordo-sky/[0.08]" width={3} />
      <CornerOrnament className="absolute left-4 top-10 h-28 w-28 opacity-40" />
      <CornerOrnament className="absolute right-4 top-10 h-28 w-28 -scale-x-100 opacity-40" />
      <CornerOrnament className="absolute bottom-10 left-4 h-28 w-28 -scale-y-100 opacity-40" />
      <CornerOrnament className="absolute bottom-10 right-4 h-28 w-28 -scale-100 opacity-40" />
    </div>
  );
}

function Stage({ state, offset }: { state: ScreenState; offset: number }) {
  const g = state.game;
  const round = g.round as RoundKey | null;

  let content: ReactNode;
  let key: string;
  if (g.status === 'LOBBY') {
    key = 'lobby';
    content = <Lobby state={state} />;
  } else if (g.status === 'FINISHED') {
    key = 'finished';
    content = <Finale state={state} />;
  } else if (g.phase === 'ROUND_END' && state.leaderboard && round) {
    key = 'roundend';
    content = <BoardView title={ky.screen.roundResults(round)} rows={state.leaderboard} />;
  } else if (g.showLeaderboard && state.leaderboard) {
    key = 'board';
    content = <BoardView title={ky.screen.leaderboard} subtitle={round ? ky.rounds[round] : undefined} rows={state.leaderboard} />;
  } else if (g.phase === 'IDLE' && round) {
    key = `idle-${round}`;
    content = <RoundIntro round={round} qualifiers={state.qualifiers} />;
  } else if (g.phase === 'READY' && state.question && round) {
    key = `ready-${state.question.number}`;
    content = <ReadyView round={round} number={state.question.number} total={g.total} />;
  } else {
    key = `q-${state.question?.number}`;
    content = <QuestionView state={state} offset={offset} />;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div key={key} className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} transition={{ duration: 0.35 }}>
        {content}
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────── Лобби ───────────────────────────

function Lobby({ state }: { state: ScreenState }) {
  const [base, setBase] = useState('');
  useEffect(() => {
    void getJoinBase().then(setBase);
  }, []);
  const g = state.game;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[3vh] px-10">
      <Logo size="xl" />
      <div className="flex items-center gap-14">
        {base && <JoinQr url={`${base}/join?code=${g.code}`} size={Math.min(260, window.innerHeight * 0.26)} />}
        <div className="space-y-3">
          <div className="text-3xl text-white/70">{ky.screen.joinAt}</div>
          <div className="font-mono text-4xl font-bold text-ordo-sky-light">{base ? `${base.replace(/^https?:\/\//, '')}/join` : '…'}</div>
          <div className="flex items-baseline gap-5">
            <span className="text-3xl text-white/70">{ky.screen.code}:</span>
            <span className="font-display text-[clamp(4rem,8vw,8rem)] font-black leading-none tracking-[0.12em] text-gold-gradient">{g.code}</span>
          </div>
          <div className="text-xl text-white/50">🔒 {ky.screen.pinNote}</div>
        </div>
      </div>
      <div className="w-full max-w-6xl">
        <div className="mb-3 text-center font-display text-2xl text-white/70">
          {state.players.length ? ky.screen.playersJoined(state.players.length) : ky.screen.waitingPlayers}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <AnimatePresence>
            {state.players.map((p) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.3, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: 'spring', damping: 12 }}
                className="rounded-2xl bg-gradient-to-b from-ordo-red to-ordo-red-dark px-6 py-3 font-display text-2xl font-bold shadow-lg ring-2 ring-ordo-gold/50"
              >
                {p.name}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Тур башталышы / өткөндөр ───────────────────────────

function RoundIntro({ round, qualifiers }: { round: RoundKey; qualifiers: { id: number; name: string }[] | null }) {
  useEffect(() => {
    if (qualifiers?.length) burst(round === 'FINAL');
  }, [qualifiers?.length, round]);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[4vh] px-10">
      <motion.div initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 10 }} className="flex items-center gap-8">
        <HornMotif className="w-32 text-ordo-gold" />
        <div className="font-display text-[clamp(5rem,12vw,11rem)] font-black leading-none text-gold-gradient drop-shadow-[0_8px_40px_rgba(245,183,0,0.4)]">
          {ky.roundsUpper[round]}
        </div>
        <HornMotif className="w-32 -scale-x-100 text-ordo-gold" />
      </motion.div>
      {qualifiers && qualifiers.length > 0 && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="font-display text-4xl font-bold tracking-wider text-ordo-sky-light">
            {ky.screen.qualifiedTo(round)}
          </motion.div>
          <div className="flex max-w-7xl flex-wrap justify-center gap-5">
            {qualifiers.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 60, rotateX: 90 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ delay: 1 + i * 0.35, type: 'spring', damping: 12 }}
                className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-ordo-gold-light to-ordo-gold-dark px-10 py-6 font-display text-4xl font-black text-ordo-night shadow-[0_0_50px_rgba(245,183,0,0.45)]"
              >
                ⭐ {p.name}
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ReadyView({ round, number, total }: { round: RoundKey; number: number; total: number }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <div className="font-display text-4xl tracking-widest text-ordo-sky-light">{ky.roundsUpper[round]}</div>
      <motion.div
        initial={{ scale: 2.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 12 }}
        className="font-display text-[clamp(6rem,14vw,13rem)] font-black leading-none text-gold-gradient"
      >
        {ky.screen.questionNo(number, total)}
      </motion.div>
      <div className="text-3xl text-white/50">{ky.screen.ofTotal(total)}</div>
    </div>
  );
}

// ─────────────────────────── Суроо / Туура жооп ───────────────────────────

function QuestionView({ state, offset }: { state: ScreenState; offset: number }) {
  const g = state.game;
  const q = state.question;
  const msLeft = useCountdown(g.phase === 'QUESTION' ? g.endsAt : null, offset, g.phase === 'QUESTION' ? g.pausedRemainingMs : null);
  if (!q || !q.options) return null;
  const revealed = !!q.correct;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[2vh] px-[4vw] py-[2vh]">
      <div className="flex items-start gap-8">
        <div className="flex-1">
          <div className="mb-3 font-display text-2xl tracking-widest text-ordo-sky-light">
            {g.round && ky.roundsUpper[g.round]} · {q.number}/{g.total}
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-[clamp(2rem,3.4vw,4.2rem)] font-bold leading-[1.15] text-white"
          >
            {q.text}
          </motion.h1>
        </div>
        {g.phase === 'QUESTION' ? (
          <RingTimer msLeft={msLeft} totalSec={g.timerSeconds} size={Math.min(200, window.innerHeight * 0.2)} paused={g.paused} />
        ) : (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="rounded-3xl bg-emerald-500 px-8 py-5 font-display text-3xl font-black shadow-[0_0_50px_rgba(16,185,129,0.5)]">
            ✓ {ky.admin.control.correctAnswer}: {q.correct && ky.options[q.correct]}
          </motion.div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 gap-[3vw]">
        {q.imageUrl && (
          <motion.img initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} src={assetUrl(q.imageUrl)} alt="" className="max-h-full w-[34%] self-center rounded-3xl object-contain shadow-2xl ring-4 ring-ordo-gold/40" />
        )}
        <div className="grid flex-1 auto-rows-fr grid-cols-2 content-center gap-[2vh]">
          {OPTION_KEYS.map((k, i) => (
            <OptionCard key={k} letter={k} text={q.options![k]} index={i} correct={revealed && q.correct === k} dim={revealed && q.correct !== k} count={revealed ? (q.stats?.[k] ?? 0) : null} />
          ))}
        </div>
      </div>

      {/* Оюнчулар: ким жооп бергени (жооптун өзү көрүнбөйт), ачылгандан кийин ✓/✗ */}
      <div className="flex flex-wrap justify-center gap-2.5">
        {state.players.map((p) => {
          const cls =
            p.correct === true
              ? 'bg-emerald-500 ring-emerald-300'
              : p.correct === false
                ? 'bg-ordo-red ring-red-300'
                : p.answered
                  ? 'bg-ordo-gold text-ordo-night ring-ordo-gold-light shadow-[0_0_24px_rgba(245,183,0,0.6)]'
                  : 'bg-white/10 ring-white/15 text-white/70';
          return (
            <motion.div
              key={p.id}
              layout
              animate={p.answered && !revealed ? { scale: [1, 1.15, 1] } : { scale: 1 }}
              className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 font-display text-[clamp(1rem,1.5vw,1.6rem)] font-bold ring-2 ${cls}`}
            >
              {p.correct === true ? '✓' : p.correct === false ? '✗' : p.answered ? '●' : '○'} {p.name}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────── Рейтинг ───────────────────────────

function BoardView({ title, subtitle, rows }: { title: string; subtitle?: string; rows: ScreenState['leaderboard'] }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center px-[6vw] py-[3vh]">
      <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-[3vh] flex items-center gap-6">
        <span className="text-6xl">🏆</span>
        <div className="text-center">
          <div className="font-display text-[clamp(3rem,5vw,5.5rem)] font-black leading-none text-gold-gradient">{title}</div>
          {subtitle && <div className="mt-2 font-display text-2xl text-ordo-sky-light">{subtitle}</div>}
        </div>
        <span className="text-6xl">🏆</span>
      </motion.div>
      <div className="min-h-0 w-full max-w-5xl flex-1 overflow-hidden">
        <LeaderboardList rows={rows ?? []} big compact={(rows ?? []).length > 8} maxRows={12} highlight={(rows ?? []).filter((r) => r.rank <= 3).map((r) => r.playerId)} />
      </div>
    </div>
  );
}

// ─────────────────────────── Финал: пьедестал ───────────────────────────

function Finale({ state }: { state: ScreenState }) {
  const [showTable, setShowTable] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => burst(true), 2000);
    const t2 = setTimeout(() => setShowTable(true), 14000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  const totals = new Map((state.standings ?? []).map((s) => [s.playerId, s.total]));
  const top = (state.finalRanking ?? []).slice(0, 3).map((r) => ({ name: r.name, score: r.score, total: totals.get(r.playerId) }));

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[3vh] px-10" onDoubleClick={() => setShowTable((v) => !v)}>
      <motion.div initial={{ opacity: 0, y: -40 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-6">
        <SunTunduk size={110} />
        <div className="font-display text-[clamp(3rem,6vw,6.5rem)] font-black text-gold-gradient">{ky.screen.congrats}</div>
        <SunTunduk size={110} />
      </motion.div>
      <AnimatePresence mode="wait">
        {!showTable ? (
          <motion.div key="podium" exit={{ opacity: 0 }}>
            <Podium top={top} />
          </motion.div>
        ) : (
          <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-6xl">
            <div className="mb-4 text-center font-display text-4xl font-bold">{ky.screen.finalTable}</div>
            <table className="w-full text-[clamp(1rem,1.6vw,1.8rem)]">
              <thead>
                <tr className="text-white/50">
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">{ky.admin.results.name}</th>
                  {(['ROUND1', 'ROUND2', 'FINAL'] as RoundKey[]).map((r) => (
                    <th key={r} className="p-2">
                      {ky.rounds[r]}
                    </th>
                  ))}
                  <th className="p-2">{ky.screen.total}</th>
                </tr>
              </thead>
              <tbody>
                {(state.standings ?? []).map((s, i) => (
                  <motion.tr key={s.playerId} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className={`border-t border-white/10 ${s.place <= 3 ? 'text-ordo-gold-light' : ''}`}>
                    <td className="p-2 font-display font-black">{s.place}</td>
                    <td className="p-2 font-semibold">{s.name}</td>
                    {(['ROUND1', 'ROUND2', 'FINAL'] as RoundKey[]).map((r) => (
                      <td key={r} className="p-2 text-center tabular-nums">
                        {s.rounds[r]?.score ?? '—'}
                      </td>
                    ))}
                    <td className="p-2 text-center font-display font-black tabular-nums">{s.total}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────── Үндөр ───────────────────────────

/** Абалдын өзгөрүшүнө жараша үн чыгарат (алып баруучу өчүрсө — үнсүз) */
function SoundDirector({ state, offset }: { state: ScreenState; offset: number }) {
  const g = state.game;
  const prev = useRef<{ phase: string; status: string; board: boolean; players: number; q: number | undefined } | null>(null);
  const msLeft = useCountdown(g.phase === 'QUESTION' && !g.paused ? g.endsAt : null, offset);
  const lastSec = useRef<number | null>(null);

  useEffect(() => {
    const cur = { phase: g.phase, status: g.status, board: g.showLeaderboard, players: state.players.length, q: state.question?.number };
    const p = prev.current;
    prev.current = cur;
    if (!p) return;
    if (cur.status === 'FINISHED' && p.status !== 'FINISHED') sfx.victory();
    else if (cur.status !== p.status && g.phase === 'IDLE' && state.qualifiers?.length) sfx.advance();
    else if (cur.phase === 'QUESTION' && (p.phase !== 'QUESTION' || p.q !== cur.q)) sfx.question();
    else if (cur.phase === 'REVEAL' && p.phase !== 'REVEAL') sfx.correct();
    else if (cur.phase === 'ROUND_END' && p.phase !== 'ROUND_END') sfx.whoosh();
    else if (cur.board && !p.board) sfx.whoosh();
    else if (cur.status === 'LOBBY' && cur.players > p.players) sfx.join();
  }, [g.phase, g.status, g.showLeaderboard, state.players.length, state.question?.number, state.qualifiers?.length]);

  useEffect(() => {
    if (g.phase !== 'QUESTION' || g.paused || !g.endsAt) {
      lastSec.current = null;
      return;
    }
    const sec = Math.ceil(msLeft / 1000);
    if (lastSec.current !== null && sec !== lastSec.current) {
      if (sec === 0) sfx.timeUp();
      else if (sec <= 5) sfx.tick(true);
    }
    lastSec.current = sec;
  }, [msLeft, g.phase, g.paused, g.endsAt]);

  return null;
}
