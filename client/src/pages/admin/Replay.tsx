import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LeaderboardList, OPTION_STYLE } from '../../components/game';
import { OrnamentBand } from '../../components/Ornament';
import { Button, Spinner } from '../../components/ui';
import { ky, type OptionKey } from '../../i18n/ky';
import { api, assetUrl } from '../../lib/api';
import { answerLabel } from '../../lib/questions';
import { optionKeysFor, type ReplayStep } from '../../lib/types';

/** Оюнду кайталап көрүү: ар бир суроо, ким эмне жооп бергени, андан кийинки рейтинг */
export default function Replay() {
  const t = ky.replay;
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<{ game: { title: string | null; code: string }; steps: ReplayStep[] } | null>(null);
  const [i, setI] = useState(0);

  useEffect(() => {
    api.get<{ game: { title: string | null; code: string }; steps: ReplayStep[] }>(`/api/games/${id}/replay`).then(setData);
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!data) return;
      if (e.key === 'ArrowRight' || e.key === ' ') setI((x) => Math.min(data.steps.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [data]);

  if (!data)
    return (
      <div className="bg-night flex min-h-dvh items-center justify-center">
        <Spinner className="h-12 w-12 text-ordo-gold" />
      </div>
    );

  const step = data.steps[i];
  return (
    <div className="bg-night flex min-h-dvh flex-col text-white">
      <OrnamentBand height={18} />
      <div className="flex flex-wrap items-center gap-3 px-6 py-3">
        <Button variant="dark" size="sm" onClick={() => navigate(`/admin/games/${id}`)}>
          ← {ky.common.back}
        </Button>
        <div className="font-display text-xl font-black text-gold-gradient">⏯ {t.title}</div>
        <div className="text-white/60">{data.game.title ?? data.game.code}</div>
        <div className="flex-1" />
        <span className="text-sm text-white/40">{t.keysHint}</span>
      </div>

      {!step ? (
        <div className="flex flex-1 items-center justify-center text-white/60">{t.empty}</div>
      ) : (
        <div className="grid flex-1 gap-6 px-6 pb-6 lg:grid-cols-3">
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4 lg:col-span-2">
              <div className="font-display text-lg tracking-widest text-ordo-sky-light">
                {ky.roundsUpper[step.round]} · №{step.number} {step.category && <span className="text-white/50">#{step.category}</span>}
              </div>
              <div className="flex gap-4">
                {step.imageUrl && <img src={assetUrl(step.imageUrl)} alt="" className="h-36 w-52 rounded-2xl object-cover" />}
                <h1 className="font-display text-3xl font-bold leading-tight">{step.text}</h1>
              </div>
              {step.type === 'ORDER' ? (
                <ol className="space-y-2">
                  {[...step.correct].map((l, k) => (
                    <li key={l} className="flex items-center gap-3 rounded-2xl bg-emerald-500/20 p-3 ring-1 ring-emerald-400">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 font-display font-black">{k + 1}</span>
                      {step.options[l as OptionKey]}
                    </li>
                  ))}
                </ol>
              ) : (
                <div className={`grid gap-3 ${step.type === 'TF' ? 'grid-cols-2' : 'sm:grid-cols-2'}`}>
                  {optionKeysFor(step.type).map((k) => {
                    const ok = step.correct === k;
                    const n = step.answers.filter((a) => a.choice === k).length;
                    return (
                      <div key={k} className={`flex items-center gap-3 rounded-2xl p-3 ring-2 ${ok ? 'bg-emerald-500/20 ring-emerald-400' : 'bg-white/5 ring-white/10 opacity-70'}`}>
                        <span className={`flex h-10 w-10 items-center justify-center rounded-xl font-display text-xl font-black ${OPTION_STYLE[k].bg}`}>{ky.options[k]}</span>
                        <span className="flex-1 font-semibold">{step.type === 'TF' ? ky.tf[k] : step.options[k]}</span>
                        <span className="rounded-lg bg-black/30 px-2 font-bold tabular-nums">{n}</span>
                        {step.audience[k] ? <span className="rounded-lg bg-violet-600/50 px-2 text-sm">👥 {step.audience[k]}</span> : null}
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <div className="mb-2 font-display font-bold">{t.answers}</div>
                <div className="flex flex-wrap gap-2">
                  {[...step.answers]
                    .sort((a, b) => a.responseMs - b.responseMs)
                    .map((a) => (
                      <span key={a.playerId} className={`rounded-xl px-3 py-1.5 font-semibold ${a.isCorrect ? 'bg-emerald-500' : 'bg-ordo-red'}`}>
                        {a.isCorrect ? '✓' : '✗'} {a.name} · {answerLabel(step.type, a.choice)} · {ky.common.sec(a.responseMs)}
                        {a.bonus > 0 && ` ⚡+${a.bonus}`}
                      </span>
                    ))}
                  {step.notAnswered.map((n) => (
                    <span key={n} className="rounded-xl bg-white/10 px-3 py-1.5 text-white/50">
                      ○ {n}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <aside className="rounded-3xl bg-white/[0.05] p-4 ring-1 ring-white/10">
            <div className="mb-3 font-display font-bold">🏆 {t.leaderboard}</div>
            <LeaderboardList rows={step.leaderboard} maxRows={12} />
          </aside>
        </div>
      )}

      <div className="flex items-center justify-center gap-4 pb-6">
        <Button variant="dark" size="lg" disabled={i === 0} onClick={() => setI(i - 1)}>
          ← {t.prev}
        </Button>
        <div className="font-display text-xl tabular-nums">{t.step(i + 1, data.steps.length)}</div>
        <Button variant="gold" size="lg" disabled={i >= data.steps.length - 1} onClick={() => setI(i + 1)}>
          {t.next} →
        </Button>
      </div>
      <OrnamentBand height={18} flip />
    </div>
  );
}
