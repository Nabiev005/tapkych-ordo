import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Spinner, useDialogs } from '../../components/ui';
import { fmtDateTime, ky, type RoundKey } from '../../i18n/ky';
import { api } from '../../lib/api';
import type { GameRow } from '../../lib/types';

type Summary = { round: RoundKey; count: number; required: number; ok: boolean };

export function ReadinessCards({ summary }: { summary: Summary[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {summary.map((s) => (
        <div
          key={s.round}
          className={`flex items-center gap-4 rounded-2xl border-2 p-4 ${s.ok ? 'border-emerald-300 bg-emerald-50' : 'border-ordo-red/30 bg-ordo-red/5'}`}
        >
          <div className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ${s.ok ? 'bg-emerald-500 text-white' : 'bg-ordo-red text-white'}`}>
            {s.ok ? '✓' : '!'}
          </div>
          <div>
            <div className="font-display font-bold">{ky.admin.dashboard.roundStatus(s.round, s.count)}</div>
            <div className={`text-sm font-semibold ${s.ok ? 'text-emerald-700' : 'text-ordo-red'}`}>
              {s.ok ? ky.admin.dashboard.enough : ky.admin.dashboard.need(s.required - s.count)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { confirm, toast } = useDialogs();
  const [summary, setSummary] = useState<Summary[] | null>(null);
  const [games, setGames] = useState<GameRow[] | null>(null);

  const load = () => {
    api.get<{ summary: Summary[] }>('/api/questions/summary').then((r) => setSummary(r.summary)).catch((e) => toast(e.message, 'err'));
    api.get<{ games: GameRow[] }>('/api/games').then((r) => setGames(r.games)).catch((e) => toast(e.message, 'err'));
  };
  useEffect(load, [toast]);

  const remove = async (g: GameRow) => {
    if (!(await confirm({ title: ky.admin.dashboard.deleteGame, message: ky.admin.dashboard.deleteGameConfirm, danger: true, confirmText: ky.common.delete }))) return;
    await api.del(`/api/games/${g.id}`).catch((e) => toast(e.message, 'err'));
    load();
  };

  return (
    <div className="space-y-8">
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl bg-night p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-display text-3xl font-black md:text-4xl">
              <span className="text-gold-gradient">{ky.appName}</span>
            </h1>
            <p className="mt-2 text-white/70">{ky.tagline}</p>
          </div>
          <Button size="xl" variant="gold" icon="✨" onClick={() => navigate('/admin/games/new')}>
            {ky.admin.dashboard.newGame}
          </Button>
        </div>
      </motion.section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">{ky.admin.dashboard.readiness}</h2>
          <Link to="/admin/questions" className="font-semibold text-ordo-sky hover:underline">
            {ky.admin.nav.questions} →
          </Link>
        </div>
        {summary ? <ReadinessCards summary={summary} /> : <Spinner />}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-bold">{ky.admin.dashboard.games}</h2>
        {!games ? (
          <Spinner />
        ) : games.length === 0 ? (
          <div className="card p-8 text-center text-ordo-ink/60">{ky.admin.dashboard.noGames}</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {games.map((g) => (
              <div key={g.id} className="card flex items-center gap-4 p-5">
                <div className="rounded-2xl bg-ordo-night px-4 py-3 font-display text-xl font-bold tracking-widest text-ordo-gold">{g.code}</div>
                <div className="flex-1">
                  <div className="font-semibold">{g.title || ky.admin.dashboard.status[g.status]}</div>
                  {g.title && <div className="text-sm font-semibold text-ordo-ink/60">{ky.admin.dashboard.status[g.status]}</div>}
                  <div className="text-sm text-ordo-ink/50">
                    {ky.admin.dashboard.players(g._count?.players ?? 0)} · {fmtDateTime(g.createdAt)}
                  </div>
                </div>
                <Button variant="sky" onClick={() => navigate(`/admin/games/${g.id}`)}>
                  {ky.admin.dashboard.open}
                </Button>
                <button className="rounded-xl p-2 text-ordo-ink/30 hover:bg-ordo-red/10 hover:text-ordo-red" title={ky.admin.dashboard.deleteGame} onClick={() => remove(g)}>
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
