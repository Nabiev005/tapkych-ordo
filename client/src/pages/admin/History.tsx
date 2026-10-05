import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner, useDialogs } from '../../components/ui';
import { fmtDateTime, ky } from '../../i18n/ky';
import { api } from '../../lib/api';
import type { HistoryGame } from '../../lib/types';

export default function History() {
  const t = ky.admin.history;
  const navigate = useNavigate();
  const { toast } = useDialogs();
  const [games, setGames] = useState<HistoryGame[] | null>(null);

  useEffect(() => {
    api
      .get<{ games: HistoryGame[] }>('/api/games/history')
      .then((r) => setGames(r.games))
      .catch((e) => toast(e.message, 'err'));
  }, [toast]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-black">{t.title}</h1>
        <p className="text-ordo-ink/60">{t.hint}</p>
      </div>
      {!games ? (
        <Spinner />
      ) : games.length === 0 ? (
        <div className="card p-10 text-center text-ordo-ink/60">{t.empty}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {games.map((g, i) => (
            <motion.button
              key={g.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => navigate(`/admin/games/${g.id}`)}
              className="card group p-5 text-left transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-display text-lg font-bold">{g.title || t.untitled}</div>
                  <div className="text-sm text-ordo-ink/50">
                    {fmtDateTime(g.finishedAt ?? g.createdAt)} · {t.players(g.players)} · {t.questions(g.questions)}
                  </div>
                </div>
                <span className="rounded-xl bg-ordo-night px-3 py-1 font-mono text-sm font-bold tracking-widest text-ordo-gold">{g.code}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {g.top.map((p, k) => (
                  <span key={k} className={`rounded-full px-3 py-1 text-sm font-semibold ${k === 0 ? 'bg-ordo-gold/30' : 'bg-ordo-ink/5'}`}>
                    {['🥇', '🥈', '🥉'][k]} {p.name} · {p.total}
                  </span>
                ))}
              </div>
              <div className="mt-3 text-sm font-semibold text-ordo-sky group-hover:underline">{t.open} →</div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
