import { motion } from 'framer-motion';
import { useState } from 'react';
import { Button, useDialogs } from '../../../components/ui';
import { ky } from '../../../i18n/ky';
import { downloadFile } from '../../../lib/api';
import { ROUND_KEYS, type AdminState } from '../../../lib/types';
import type { Act } from '../GameControl';

export default function ResultsPanel({ state }: { state: AdminState; act: Act }) {
  const t = ky.admin.results;
  const { toast } = useDialogs();
  const [busy, setBusy] = useState(false);
  const top = state.standings.slice(0, 3);

  const exportXlsx = async () => {
    setBusy(true);
    try {
      await downloadFile(`/api/games/${state.game.id}/export.xlsx`, ky.files.results(state.game.code));
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-night p-8 text-white shadow-xl">
        <h1 className="mb-6 text-center font-display text-3xl font-black text-gold-gradient">{t.title}</h1>
        <div className="grid gap-4 md:grid-cols-3">
          {top.map((s, i) => (
            <motion.div
              key={s.playerId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15 }}
              className={`rounded-3xl p-5 text-center ring-2 ${i === 0 ? 'bg-ordo-gold/20 ring-ordo-gold md:order-2 md:scale-105' : i === 1 ? 'bg-white/10 ring-slate-300 md:order-1' : 'bg-orange-400/10 ring-orange-400 md:order-3'}`}
            >
              <div className="text-5xl">{['🥇', '🥈', '🥉'][i]}</div>
              <div className="mt-2 font-display text-2xl font-bold">{s.name}</div>
              <div className="text-white/60">{ky.screen.places[i]}</div>
              <div className="mt-2 font-display text-xl text-ordo-gold-light">
                {ky.rounds.FINAL}: {s.rounds.FINAL?.score ?? 0} · {t.total}: {s.total}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="card overflow-x-auto p-5">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b-2 border-ordo-gold/30 text-sm uppercase tracking-wide text-ordo-ink/50">
              <th className="p-2">{t.place}</th>
              <th className="p-2">{t.name}</th>
              {ROUND_KEYS.map((r) => (
                <th key={r} className="p-2 text-center">
                  {ky.rounds[r]}
                </th>
              ))}
              <th className="p-2 text-center">{t.total}</th>
              <th className="p-2">{t.reached}</th>
            </tr>
          </thead>
          <tbody>
            {state.standings.map((s) => (
              <tr key={s.playerId} className={`border-b border-ordo-gold/10 ${s.place <= 3 ? 'bg-ordo-gold/10 font-semibold' : ''}`}>
                <td className="p-2 font-display font-bold">{s.place}</td>
                <td className="p-2">{s.name}</td>
                {ROUND_KEYS.map((r) => (
                  <td key={r} className="p-2 text-center tabular-nums">
                    {s.rounds[r] ? s.rounds[r]!.score : '—'}
                  </td>
                ))}
                <td className="p-2 text-center font-display font-black text-ordo-red tabular-nums">{s.total}</td>
                <td className="p-2 text-sm text-ordo-ink/60">{ky.rounds[s.reached]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {state.askedQuestions.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 font-display text-lg font-bold">❓ {t.askedTitle}</h2>
          <div className="space-y-1.5">
            {state.askedQuestions.map((q) => {
              const pct = q.answered ? Math.round((q.correctCount / q.answered) * 100) : 0;
              return (
                <div key={q.id} className="flex items-center gap-3 rounded-xl px-2 py-2 odd:bg-ordo-cream">
                  <span className="w-20 shrink-0 text-xs font-bold text-ordo-ink/50">
                    {ky.rounds[q.round]} · №{q.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{q.text}</div>
                    <div className="text-sm text-emerald-700">
                      ✓ {ky.options[q.correct]} — {q.correctText}
                    </div>
                  </div>
                  <div className="w-24 shrink-0 text-right">
                    <div className="text-sm font-bold">{t.askedStats(q.correctCount, q.answered)}</div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ordo-ink/10">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="card flex flex-col items-center gap-3 p-6 text-center">
        <Button size="xl" variant="green" icon="📊" loading={busy} onClick={exportXlsx}>
          {t.export}
        </Button>
        <p className="text-ordo-ink/60">{t.exportHint}</p>
      </section>
    </div>
  );
}
