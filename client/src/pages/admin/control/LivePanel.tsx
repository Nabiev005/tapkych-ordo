import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { LeaderboardList, OPTION_STYLE, RingTimer, TeamBoard } from '../../../components/game';
import { Button, Modal, useDialogs } from '../../../components/ui';
import { ky, type OptionKey, type RoundKey } from '../../../i18n/ky';
import { optionKeysFor, type AdminState } from '../../../lib/types';
import { answerLabel } from '../../../lib/questions';
import { useCountdown } from '../../../lib/useGameSocket';
import { assetUrl } from '../../../lib/api';
import type { Act } from '../GameControl';

export default function LivePanel({ state, act, busy, offset }: { state: AdminState; act: Act; busy: string | null; offset: number }) {
  const t = ky.admin.control;
  const { confirm } = useDialogs();
  const g = state.game;
  const round = g.round as RoundKey;
  const q = state.question;
  const msLeft = useCountdown(g.phase === 'QUESTION' ? g.endsAt : null, offset, g.phase === 'QUESTION' ? g.pausedRemainingMs : null);
  const isLast = g.index === g.total - 1;
  const [adjusting, setAdjusting] = useState<number | null>(null);

  const active = state.players.filter((p) => state.activeIds.includes(p.id));
  const answeredCount = active.filter((p) => state.answers[p.id]).length;
  const correctCount = active.filter((p) => state.answers[p.id]?.isCorrect).length;

  // ───── Баскычтар ─────
  const doReveal = async () => {
    const unanswered = active.length - answeredCount;
    if (msLeft > 0 && unanswered > 0) {
      if (!(await confirm({ title: t.btn.reveal, message: t.confirms.revealEarly(unanswered), confirmText: t.btn.reveal }))) return;
    }
    await act({ type: 'revealAnswer' });
  };
  const doEndRound = async () => {
    if (await confirm({ title: t.btn.endRound, message: t.confirms.endRound, confirmText: t.btn.endRound })) await act({ type: 'endRound' });
  };
  const doRestart = async () => {
    if (await confirm({ title: t.btn.restartQuestion, message: t.confirms.restartQuestion, danger: true, confirmText: t.btn.restartQuestion }))
      await act({ type: 'restartQuestion' });
  };

  const primary: { label: string; onClick: () => void; type: string; variant: 'green' | 'sky' | 'gold' | 'red' } | null =
    g.phase === 'IDLE'
      ? { label: t.btn.firstQuestion, onClick: () => act({ type: 'nextQuestion' }), type: 'nextQuestion', variant: 'sky' }
      : g.phase === 'READY'
        ? { label: t.btn.showQuestion, onClick: () => act({ type: 'showQuestion' }), type: 'showQuestion', variant: 'green' }
        : g.phase === 'QUESTION'
          ? { label: t.btn.reveal, onClick: doReveal, type: 'revealAnswer', variant: 'gold' }
          : g.phase === 'REVEAL'
            ? isLast
              ? { label: t.btn.endRound, onClick: doEndRound, type: 'endRound', variant: 'red' }
              : { label: t.btn.nextQuestion, onClick: () => act({ type: 'nextQuestion' }), type: 'nextQuestion', variant: 'sky' }
            : null;

  const hint =
    g.phase === 'REVEAL' && isLast
      ? t.hints.REVEAL_LAST
      : g.phase === 'ROUND_END' && round === 'FINAL'
        ? t.hints.ROUND_END_FINAL
        : t.hints[g.phase as keyof typeof t.hints];

  return (
    <div className="space-y-5">
      {/* Абал тилкеси */}
      <div className="relative overflow-hidden rounded-3xl bg-night p-5 text-white shadow-xl">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <div className="font-display text-3xl font-black text-gold-gradient md:text-4xl">
              {g.phase === 'IDLE' || g.phase === 'ROUND_END' ? ky.rounds[round] : t.roundProgress(round, g.index + 1, g.total)}
            </div>
            <div className="mt-1 max-w-xl text-white/70">{hint}</div>
          </div>
          <div className="flex-1" />
          {g.phase === 'QUESTION' && <RingTimer msLeft={msLeft} totalSec={g.timerSeconds} size={96} paused={g.paused && g.pausedRemainingMs !== null} />}
          {g.phase === 'QUESTION' && (
            <div className="text-right">
              <div className="font-display text-4xl font-black tabular-nums">
                {answeredCount}/{active.length}
              </div>
              <div className="text-sm text-white/60">{t.answeredShort}</div>
            </div>
          )}
        </div>
        <AnimatePresence>
          {g.paused && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-ordo-red/90 font-display text-4xl font-black tracking-widest"
            >
              ⏸ {t.paused}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {g.phase === 'ROUND_END' ? (
        <RoundEndPanel state={state} act={act} busy={busy} onAdjust={setAdjusting} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-2">
            {/* Башкаруу баскычтары */}
            <section className="card space-y-4 p-5">
              {primary && (
                <div>
                  <div className="mb-1.5 text-xs font-bold uppercase tracking-widest text-ordo-ink/40">{t.nextStep}</div>
                  <Button size="xl" variant={primary.variant} className="w-full py-7 text-3xl" pulse loading={busy === primary.type} disabled={g.paused} onClick={primary.onClick}>
                    {primary.label} →
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                <Button size="lg" variant="sky" disabled={g.paused || !(g.phase === 'IDLE' || (g.phase === 'REVEAL' && !isLast))} loading={busy === 'nextQuestion'} onClick={() => act({ type: 'nextQuestion' })}>
                  ⏭ {g.phase === 'IDLE' ? t.btn.firstQuestion : t.btn.nextQuestion}
                </Button>
                <Button size="lg" variant="green" disabled={g.paused || g.phase !== 'READY'} loading={busy === 'showQuestion'} onClick={() => act({ type: 'showQuestion' })}>
                  👁 {t.btn.showQuestion}
                </Button>
                <Button size="lg" variant="gold" disabled={g.phase !== 'QUESTION'} loading={busy === 'revealAnswer'} onClick={doReveal}>
                  ✅ {t.btn.reveal}
                </Button>
                <Button size="lg" variant="dark" disabled={g.phase === 'QUESTION'} loading={busy === 'toggleLeaderboard'} onClick={() => act({ type: 'toggleLeaderboard' })}>
                  🏆 {g.showLeaderboard ? t.btn.hideLeaderboard : t.btn.leaderboard}
                </Button>
                <Button size="lg" variant="red" disabled={g.paused || !(g.phase === 'REVEAL' && isLast)} loading={busy === 'endRound'} onClick={doEndRound}>
                  🏁 {t.btn.endRound}
                </Button>
                <Button size="lg" variant={g.paused ? 'green' : 'outline'} loading={busy === 'togglePause'} onClick={() => act({ type: 'togglePause' })}>
                  {g.paused ? `▶ ${t.btn.resume}` : `⏸ ${t.btn.pause}`}
                </Button>
              </div>
              {(g.phase === 'QUESTION' || g.phase === 'REVEAL') && (
                <div className="text-right">
                  <button className="text-sm font-semibold text-ordo-ink/40 underline-offset-2 hover:text-ordo-red hover:underline" onClick={doRestart}>
                    ↺ {t.btn.restartQuestion}
                  </button>
                </div>
              )}
            </section>

            {/* Суроо (алып баруучу туура жоопту дайыма көрөт) */}
            {q && (
              <section className="card p-5">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-ordo-ink/40">
                  {t.question} №{q.number}
                  {g.phase === 'READY' && <span className="rounded bg-ordo-gold/30 px-2 text-ordo-ink/70">{t.hiddenOnScreen}</span>}
                </div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {q.type !== 'CHOICE' && <span className="rounded-md bg-ordo-sky/15 px-2 py-0.5 text-xs font-bold text-ordo-sky">{ky.qtypesShort[q.type]}</span>}
                  {q.category && <span className="rounded-md bg-ordo-ink/5 px-2 py-0.5 text-xs font-semibold text-ordo-ink/70">#{q.category}</span>}
                </div>
                <div className="flex gap-4">
                  {q.imageUrl && <img src={assetUrl(q.imageUrl)} alt="" className="h-28 w-40 shrink-0 rounded-2xl object-cover" />}
                  <div className="text-xl font-semibold leading-snug">{q.text}</div>
                </div>
                {q.audioUrl && <audio controls src={assetUrl(q.audioUrl)} className="mt-3 w-full" />}
                {q.type === 'ORDER' ? (
                  <div className="mt-4">
                    <div className="mb-1 text-xs font-bold uppercase tracking-wide text-emerald-700">✓ {t.orderCorrect}</div>
                    <ol className="space-y-1.5">
                      {[...q.correct].map((l, i) => (
                        <li key={l} className="flex items-center gap-3 rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 font-display font-black text-white">{i + 1}</span>
                          <span className="font-semibold text-emerald-900">{q.options[l as OptionKey]}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {optionKeysFor(q.type).map((k) => {
                    const ok = q.correct === k;
                    return (
                      <div key={k} className={`flex items-center gap-3 rounded-2xl border-2 p-2.5 ${ok ? 'border-emerald-500 bg-emerald-50' : 'border-ordo-gold/20'}`}>
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display font-black text-white ${OPTION_STYLE[k].bg}`}>{ky.options[k]}</span>
                        <span className={`flex-1 ${ok ? 'font-bold text-emerald-800' : ''}`}>{q.type === 'TF' ? ky.tf[k] : q.options[k]}</span>
                        {ok && <span className="text-xs font-bold uppercase text-emerald-700">✓ {t.correctAnswer}</span>}
                        {(g.phase === 'QUESTION' || g.phase === 'REVEAL') && q.stats && (
                          <span className="rounded-lg bg-ordo-ink/5 px-2 py-0.5 font-bold tabular-nums text-ordo-ink/60">{q.stats[k]}</span>
                        )}
                        {q.audience.total > 0 && (
                          <span className="rounded-lg bg-violet-100 px-2 py-0.5 text-xs font-bold tabular-nums text-violet-700" title={t.audience}>
                            👥 {q.audience.counts[k]}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                )}
                {q.audience.total > 0 && <div className="mt-3 text-sm font-semibold text-violet-700">👥 {t.audienceVotes(q.audience.total)}</div>}
              </section>
            )}

            {/* Жооптор — аты-жөнү менен */}
            {q && (g.phase === 'QUESTION' || g.phase === 'REVEAL') && (
              <section className="card p-5">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <h3 className="font-display text-lg font-bold">{t.answeredCount(answeredCount, active.length)}</h3>
                  <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-sm font-bold text-emerald-700">{t.correctCount(correctCount)}</span>
                  <span className="rounded-full bg-ordo-red/10 px-3 py-0.5 text-sm font-bold text-ordo-red">{t.wrongCount(answeredCount - correctCount)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                  {active.map((p) => {
                    const a = state.answers[p.id];
                    return (
                      <motion.div
                        key={p.id}
                        layout
                        animate={a ? { scale: [1, 1.06, 1] } : undefined}
                        className={`rounded-2xl border-2 p-3 ${!a ? 'border-dashed border-slate-300 bg-slate-50 text-slate-400' : a.isCorrect ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-ordo-red bg-ordo-red text-white'}`}
                      >
                        <div className="flex items-center gap-1.5">
                          {!p.online && <span title={ky.common.offline}>📵</span>}
                          <span className="truncate font-semibold">{p.name}</span>
                          {p.fiftyUsed && <span title={t.fiftyUsed} className="ml-auto text-xs font-bold opacity-80">½</span>}
                        </div>
                        <div className="mt-0.5 text-sm opacity-90">
                          {a ? (
                            <>
                              {a.isCorrect ? '✓' : '✗'} {answerLabel(q.type, a.choice)} · {ky.common.sec(a.responseMs)}
                              {a.bonus > 0 && <span className="ml-1 font-bold">{t.bonus(a.bonus)}</span>}
                            </>
                          ) : (
                            t.notAnswered
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* Рейтинг + оюнчулар */}
          <aside className="space-y-5">
            {g.teamMode && state.teams.length > 0 && (
              <section className="card p-5">
                <h3 className="mb-3 font-display text-lg font-bold">🏫 {t.teamBoard}</h3>
                <TeamBoard teams={state.teams} light />
              </section>
            )}
            <section className="card p-5">
              <h3 className="mb-3 font-display text-lg font-bold">{t.leaderboardTitle(round)}</h3>
              <LeaderboardList rows={state.leaderboard} light />
            </section>
            <PlayersManage state={state} act={act} onAdjust={setAdjusting} />
          </aside>
        </div>
      )}

      <AdjustModal state={state} act={act} playerId={adjusting} onClose={() => setAdjusting(null)} />
    </div>
  );
}

function PlayersManage({ state, act, onAdjust }: { state: AdminState; act: Act; onAdjust: (id: number) => void }) {
  const t = ky.admin.control;
  const { confirm } = useDialogs();
  const active = state.players.filter((p) => state.activeIds.includes(p.id));
  const eliminated = state.players.filter((p) => p.status === 'ELIMINATED');
  const kicked = state.players.filter((p) => p.status === 'KICKED');

  return (
    <section className="card space-y-4 p-5">
      <div>
        <h3 className="mb-2 font-display text-lg font-bold">{t.players}</h3>
        <div className="space-y-1">
          {active.map((p) => (
            <div key={p.id} className="group flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-ordo-gold/10">
              <span className={`h-2.5 w-2.5 rounded-full ${p.online ? 'bg-emerald-500' : 'bg-slate-300'}`} title={p.online ? ky.common.online : ky.common.offline} />
              <span className="flex-1 truncate">{p.name}</span>
              <button className="rounded-lg px-2 py-0.5 text-sm font-semibold text-ordo-sky hover:bg-ordo-sky/10" onClick={() => onAdjust(p.id)}>
                ± {t.adjust}
              </button>
              <button
                className="rounded-lg px-2 py-0.5 text-sm text-ordo-ink/30 hover:bg-ordo-red/10 hover:text-ordo-red"
                title={t.kick}
                onClick={async () => {
                  if (await confirm({ title: t.kick, message: t.confirms.kick(p.name), danger: true, confirmText: t.kick })) await act({ type: 'kickPlayer', playerId: p.id });
                }}
              >
                ⛔
              </button>
            </div>
          ))}
        </div>
      </div>
      {eliminated.length > 0 && (
        <div>
          <h4 className="mb-1 text-sm font-bold uppercase tracking-wide text-ordo-ink/40">{t.spectators}</h4>
          <div className="flex flex-wrap gap-1.5">
            {eliminated.map((p) => (
              <span key={p.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500">
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}
      {kicked.length > 0 && (
        <div>
          <h4 className="mb-1 text-sm font-bold uppercase tracking-wide text-ordo-ink/40">{t.kicked}</h4>
          {kicked.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 text-ordo-ink/50 line-through">{p.name}</span>
              <button className="font-semibold text-ordo-sky hover:underline" onClick={() => act({ type: 'restorePlayer', playerId: p.id })}>
                {t.restore}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AdjustModal({ state, act, playerId, onClose }: { state: AdminState; act: Act; playerId: number | null; onClose: () => void }) {
  const t = ky.admin.control;
  const { toast } = useDialogs();
  const round = (state.game.round ?? 'FINAL') as RoundKey;
  const p = state.players.find((x) => x.id === playerId);
  const row = (state.roundEnd?.ranking ?? state.leaderboard).find((r) => r.playerId === playerId);
  const adjust = async (delta: number) => {
    if (await act({ type: 'adjustScore', playerId, delta, round })) toast(t.adjusted);
  };
  return (
    <Modal open={!!p} onClose={onClose} title={p ? t.adjustTitle(p.name) : ''}>
      <p className="mb-4 text-ordo-ink/60">{t.adjustHint(round)}</p>
      <div className="mb-6 text-center font-display text-6xl font-black text-ordo-red tabular-nums">{row?.score ?? 0}</div>
      <div className="grid grid-cols-2 gap-3">
        <Button size="xl" variant="danger" onClick={() => adjust(-1)}>
          −1
        </Button>
        <Button size="xl" variant="green" onClick={() => adjust(1)}>
          +1
        </Button>
      </div>
      <Button variant="outline" size="lg" className="mt-4 w-full" onClick={onClose}>
        {ky.common.close}
      </Button>
    </Modal>
  );
}

function RoundEndPanel({ state, act, busy, onAdjust }: { state: AdminState; act: Act; busy: string | null; onAdjust: (id: number) => void }) {
  const t = ky.admin.control;
  const { confirm } = useDialogs();
  const re = state.roundEnd!;
  const isFinal = re.round === 'FINAL';
  const suggestedKey = re.suggested.join(',');
  const [selected, setSelected] = useState<number[]>(re.suggested);
  // Упай оңдолгондо сунуш өзгөрүшү мүмкүн — тандоону жаңылайбыз
  useEffect(() => setSelected(suggestedKey ? suggestedKey.split(',').map(Number) : []), [suggestedKey]);
  const names = useMemo(() => re.ranking.filter((r) => selected.includes(r.playerId)).map((r) => r.name), [re.ranking, selected]);
  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = async () => {
    if (isFinal) {
      if (await confirm({ title: t.btn.finish, message: t.confirms.finish, confirmText: t.btn.finish })) await act({ type: 'finishGame' });
      return;
    }
    if (selected.length !== re.count && !(await confirm({ title: t.btn.nextRound, message: t.countWarn(selected.length, re.count) }))) return;
    if (await confirm({ title: t.btn.nextRound, message: t.advanceConfirm(names.join(', ')), confirmText: t.confirmAdvance }))
      await act({ type: 'confirmAdvance', playerIds: selected });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <section className="card space-y-4 p-6 xl:col-span-2">
        <h2 className="font-display text-2xl font-black">{isFinal ? t.finalRanking : t.advanceTitle(re.round)}</h2>
        {!isFinal && <p className="text-ordo-ink/60">{t.advanceHint(re.count)}</p>}
        {re.tieAtCutoff && <div className="rounded-2xl bg-ordo-red p-4 font-bold text-white">⚠ {t.tieWarn}</div>}

        <div className="space-y-2">
          {re.ranking.map((r) => {
            const on = selected.includes(r.playerId);
            return (
              <div
                key={r.playerId}
                onClick={() => !isFinal && toggle(r.playerId)}
                className={`flex items-center gap-4 rounded-2xl border-2 p-3 transition ${isFinal ? '' : 'cursor-pointer'} ${
                  isFinal ? (r.rank <= 3 ? 'border-ordo-gold bg-ordo-gold/10' : 'border-ordo-gold/20') : on ? 'border-emerald-500 bg-emerald-50' : 'border-ordo-gold/20 bg-white opacity-70'
                }`}
              >
                {!isFinal && (
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg border-2 text-lg font-bold ${on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'}`}>{on ? '✓' : ''}</div>
                )}
                <div className="w-10 text-center font-display text-2xl font-black text-ordo-ink/50">{r.rank}</div>
                <div className="flex-1 text-lg font-semibold">
                  {r.name}
                  {r.tied && <span className="ml-2 rounded bg-ordo-red px-2 py-0.5 text-xs font-bold text-white">{t.tie}</span>}
                </div>
                <div className="text-sm text-ordo-ink/50 tabular-nums">{ky.common.sec(r.timeMs)}</div>
                <div className="w-14 text-right font-display text-3xl font-black text-ordo-red tabular-nums">{r.score}</div>
                <button
                  className="rounded-lg px-2 py-1 text-sm font-semibold text-ordo-sky hover:bg-ordo-sky/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdjust(r.playerId);
                  }}
                >
                  ±
                </button>
              </div>
            );
          })}
        </div>

        {!isFinal && <div className={`text-center font-bold ${selected.length === re.count ? 'text-emerald-600' : 'text-ordo-red'}`}>{t.selected(selected.length, re.count)}</div>}

        <Button size="xl" variant={isFinal ? 'gold' : 'green'} className="w-full py-7" pulse loading={busy === 'confirmAdvance' || busy === 'finishGame'} disabled={!isFinal && selected.length === 0} onClick={submit}>
          {isFinal ? `🏆 ${t.btn.finish}` : `✓ ${t.confirmAdvance}`}
        </Button>
      </section>
      <aside className="card space-y-3 p-5">
        <h3 className="font-display text-lg font-bold">🖥 {ky.admin.control.screenLink}</h3>
        <p className="text-sm text-ordo-ink/60">{ky.screen.roundResults(re.round)}</p>
        <Button variant="outline" className="w-full" loading={busy === 'togglePause'} onClick={() => act({ type: 'togglePause' })}>
          {state.game.paused ? `▶ ${t.btn.resume}` : `⏸ ${t.btn.pause}`}
        </Button>
      </aside>
    </div>
  );
}
