import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { OrnamentBand, SunTunduk } from '../components/Ornament';
import { LangSwitch } from '../components/LangSwitch';
import { Button, Spinner } from '../components/ui';
import { ky } from '../i18n/ky';
import { adminToken, api, downloadFile } from '../lib/api';
import type { RatingRow, Season } from '../lib/types';

type SortKey = 'totalScore' | 'wins' | 'accuracy';

/** Бардык оюндар боюнча эң акылдуу окуучулардын рейтинги — ачык бет */
export default function Rating() {
  const t = ky.rating;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const seasonId = params.get('season') ?? '';
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [data, setData] = useState<{ rows: RatingRow[]; classes: string[]; games: number; tasks: number } | null>(null);
  const [error, setError] = useState('');
  const [cls, setCls] = useState('');
  const [sort, setSort] = useState<SortKey>('totalScore');
  const isAdmin = !!adminToken.get();

  useEffect(() => {
    api
      .get<{ seasons: Season[] }>('/api/seasons')
      .then((r) => setSeasons(r.seasons))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setData(null);
    api
      .get<{ rows: RatingRow[]; classes: string[]; games: number; tasks: number }>(`/api/rating${seasonId ? `?seasonId=${seasonId}` : ''}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [seasonId]);
  const openProfile = (id: number) => navigate(`/rating/student/${id}${seasonId ? `?season=${seasonId}` : ''}`);

  const rows = useMemo(() => {
    const list = (data?.rows ?? []).filter((r) => !cls || r.className === cls);
    const by: Record<SortKey, (a: RatingRow, b: RatingRow) => number> = {
      totalScore: (a, b) => b.totalScore - a.totalScore || b.wins - a.wins || b.accuracy - a.accuracy,
      wins: (a, b) => b.wins - a.wins || b.podiums - a.podiums || b.totalScore - a.totalScore,
      accuracy: (a, b) => b.accuracy - a.accuracy || b.totalScore - a.totalScore,
    };
    return [...list].sort(by[sort]);
  }, [data, cls, sort]);

  const top = rows.slice(0, 3);
  const medal = ['🥇', '🥈', '🥉'];

  return (
    <div className="bg-night min-h-dvh text-white">
      <OrnamentBand />
      <div className="flex justify-end px-4 pt-3">
        <LangSwitch dark />
      </div>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <SunTunduk size={90} />
          <h1 className="font-display text-4xl font-black text-gold-gradient md:text-6xl">{t.title}</h1>
          {data && <p className="text-lg text-ordo-sky-light">{data.tasks ? t.subtitleTasks(data.games, data.tasks) : t.subtitle(data.games)}</p>}
          {seasons.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {[{ id: '', name: t.allTime }, ...seasons.map((x) => ({ id: String(x.id), name: x.name }))].map((x) => (
                <button
                  key={x.id || 'all'}
                  onClick={() => setParams(x.id ? { season: x.id } : {})}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${seasonId === x.id ? 'bg-ordo-sky text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                >
                  📅 {x.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <div className="rounded-2xl bg-ordo-red p-4 text-center">{error}</div>}
        {!data && !error && (
          <div className="flex justify-center py-20">
            <Spinner className="h-12 w-12 text-ordo-gold" />
          </div>
        )}

        {data && data.rows.length === 0 && <div className="rounded-3xl bg-white/5 p-10 text-center text-xl text-white/70">{t.empty}</div>}

        {data && data.rows.length > 0 && (
          <>
            {/* Чыпкалар */}
            <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
              {['', ...data.classes].map((c) => (
                <button
                  key={c || 'all'}
                  onClick={() => setCls(c)}
                  className={`rounded-full px-5 py-2 font-semibold transition ${cls === c ? 'bg-ordo-gold text-ordo-night' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
                >
                  {c || t.allClasses}
                </button>
              ))}
            </div>

            {/* Алдыңкы үчтүк */}
            {top.length > 0 && (
              <div className="mb-8 grid gap-4 md:grid-cols-3">
                {top.map((r, i) => (
                  <motion.div
                    key={r.studentId}
                    onClick={() => openProfile(r.studentId)}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.12, type: 'spring', damping: 16 }}
                    className={`cursor-pointer rounded-3xl p-6 text-center ring-2 transition hover:brightness-125 ${
                      i === 0 ? 'bg-ordo-gold/20 ring-ordo-gold md:order-2 md:-translate-y-3' : i === 1 ? 'bg-white/10 ring-slate-300 md:order-1' : 'bg-orange-400/10 ring-orange-400 md:order-3'
                    }`}
                  >
                    <div className="text-6xl">{medal[i]}</div>
                    <div className="mt-2 font-display text-2xl font-black">{r.name}</div>
                    {r.className && <div className="text-ordo-sky-light">{r.className}</div>}
                    <div className="mt-3 font-display text-4xl font-black text-ordo-gold-light">{r.totalScore}</div>
                    <div className="text-sm text-white/60">
                      {t.gamesCount(r.games)} · {t.winsCount(r.wins)} · {r.accuracy}%
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-white/60">{t.sortBy}</span>
                {(Object.keys(t.sort) as SortKey[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setSort(k)}
                    className={`rounded-full px-3 py-1 font-semibold ${sort === k ? 'bg-ordo-sky text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                  >
                    {t.sort[k]}
                  </button>
                ))}
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" icon="📜" onClick={() => window.open(`/certificate?top=3${seasonId ? `&season=${seasonId}` : ''}`, '_blank')}>
                    {ky.certificate.top3}
                  </Button>
                  <Button variant="gold" size="sm" icon="📊" onClick={() => downloadFile(`/api/rating/export.xlsx${seasonId ? `?seasonId=${seasonId}` : ''}`, ky.files.rating).catch(() => undefined)}>
                    {t.export}
                  </Button>
                </div>
              )}
            </div>

            {/* Толук таблица */}
            <div className="overflow-x-auto rounded-3xl bg-white/[0.05] ring-1 ring-white/10">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="text-sm uppercase tracking-wide text-white/50">
                    <th className="p-3">#</th>
                    <th className="p-3">{t.name}</th>
                    <th className="p-3">{t.className}</th>
                    <th className="p-3 text-center">{t.games}</th>
                    <th className="p-3 text-center">{t.tasks}</th>
                    <th className="p-3 text-center">{t.wins}</th>
                    <th className="p-3 text-center">{t.podiums}</th>
                    <th className="p-3 text-center">{t.finals}</th>
                    <th className="p-3 text-center">{t.accuracy}</th>
                    <th className="p-3 text-right">{t.score}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <motion.tr
                      key={r.studentId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i, 20) * 0.03 }}
                      onClick={() => openProfile(r.studentId)}
                      className={`cursor-pointer border-t border-white/10 transition hover:bg-white/5 ${i < 3 ? 'text-ordo-gold-light' : ''}`}
                    >
                      <td className="p-3 font-display text-lg font-black">{medal[i] ?? i + 1}</td>
                      <td className="p-3 text-lg font-semibold">{r.name}</td>
                      <td className="p-3 text-white/70">{r.className}</td>
                      <td className="p-3 text-center tabular-nums">{r.games}</td>
                      <td className="p-3 text-center tabular-nums">{r.tasks}</td>
                      <td className="p-3 text-center tabular-nums">{r.wins}</td>
                      <td className="p-3 text-center tabular-nums">{r.podiums}</td>
                      <td className="p-3 text-center tabular-nums">{r.finals}</td>
                      <td className="p-3 text-center">
                        <div className="mx-auto flex w-24 items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-gradient-to-r from-ordo-sky to-emerald-400" style={{ width: `${r.accuracy}%` }} />
                          </div>
                          <span className="w-9 text-right text-sm tabular-nums">{r.accuracy}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-right font-display text-2xl font-black tabular-nums">{r.totalScore}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-center text-sm text-white/40">
              {t.rule} {t.profileHint}.
            </p>
          </>
        )}

        <div className="mt-8 text-center">
          <Link to="/" className="text-ordo-sky-light hover:underline">
            ← {t.back}
          </Link>
        </div>
      </div>
      <OrnamentBand flip />
    </div>
  );
}
