import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { OrnamentBand, SunTunduk } from '../components/Ornament';
import { Spinner } from '../components/ui';
import { fmtDate, ky } from '../i18n/ky';
import { api } from '../lib/api';
import type { StudentProfile as Profile } from '../lib/types';

/** Окуучунун жеке баракчасы — ачык бет */
export default function StudentProfile() {
  const t = ky.profile;
  const { id } = useParams();
  const [params] = useSearchParams();
  const seasonId = params.get('season');
  const [data, setData] = useState<Profile | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<Profile>(`/api/rating/student/${id}${seasonId ? `?seasonId=${seasonId}` : ''}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id, seasonId]);

  if (error) return <div className="bg-night flex min-h-dvh items-center justify-center p-6 text-white">{error}</div>;
  if (!data)
    return (
      <div className="bg-night flex min-h-dvh items-center justify-center">
        <Spinner className="h-12 w-12 text-ordo-gold" />
      </div>
    );

  const s = data.stats;
  const strongest = data.categories.filter((c) => c.answered >= 2)[0];
  const medals = [
    { icon: '🏆', label: t.medal.wins, value: s?.wins ?? 0 },
    { icon: '🥉', label: t.medal.podiums, value: s?.podiums ?? 0 },
    { icon: '⭐', label: t.medal.finals, value: s?.finals ?? 0 },
    { icon: '📝', label: t.medal.tasks, value: s?.tasks ?? 0 },
  ];

  return (
    <div className="bg-night min-h-dvh text-white">
      <OrnamentBand />
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <Link to={`/rating${seasonId ? `?season=${seasonId}` : ''}`} className="text-ordo-sky-light hover:underline">
          ← {t.back}
        </Link>

        {/* Баш жагы */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4 rounded-3xl bg-white/[0.06] p-6 text-center ring-1 ring-white/10 md:flex-row md:text-left">
          <div className="relative">
            <SunTunduk size={110} spin={false} />
            {data.rank && data.rank <= 3 && <div className="absolute -right-2 -top-2 text-4xl">{['🥇', '🥈', '🥉'][data.rank - 1]}</div>}
          </div>
          <div className="flex-1">
            <h1 className="font-display text-4xl font-black text-gold-gradient">{data.student.name}</h1>
            {data.student.className && <div className="text-xl text-ordo-sky-light">{data.student.className}</div>}
            <div className="mt-2 text-white/70">{data.rank ? t.rank(data.rank, data.of) : t.noRank}</div>
          </div>
          {s && (
            <div className="grid grid-cols-2 gap-3 text-center">
              <Stat label={ky.rating.score} value={s.totalScore} big />
              <Stat label={ky.rating.accuracy} value={`${s.accuracy}%`} big />
            </div>
          )}
        </motion.section>

        {/* Медалдар */}
        <section>
          <h2 className="mb-3 font-display text-xl font-bold">{t.medals}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {medals.map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.08 }}
                className={`rounded-3xl p-4 text-center ring-1 ${m.value > 0 ? 'bg-ordo-gold/15 ring-ordo-gold/50' : 'bg-white/5 ring-white/10 opacity-60'}`}
              >
                <div className="text-4xl">{m.icon}</div>
                <div className="mt-1 font-display text-3xl font-black">{m.value}</div>
                <div className="text-sm text-white/60">{m.label}</div>
              </motion.div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Упайдын өсүшү */}
          <section className="rounded-3xl bg-white/[0.06] p-5 ring-1 ring-white/10">
            <h2 className="font-display text-xl font-bold">📈 {t.growth}</h2>
            <p className="mb-3 text-sm text-white/50">{t.growthHint}</p>
            {data.timeline.length ? <GrowthChart points={data.timeline} /> : <p className="text-white/50">{t.empty}</p>}
          </section>

          {/* Темалар */}
          <section className="rounded-3xl bg-white/[0.06] p-5 ring-1 ring-white/10">
            <h2 className="font-display text-xl font-bold">🎯 {t.strengths}</h2>
            <p className="mb-3 text-sm text-white/50">{t.strengthsHint}</p>
            {strongest && (
              <div className="mb-3 rounded-2xl bg-emerald-500/15 px-4 py-2 text-emerald-200">
                💪 {t.strongest}: <b>{strongest.category || ky.noCategory}</b> — {strongest.accuracy}%
              </div>
            )}
            <div className="space-y-2">
              {data.categories.length === 0 && <p className="text-white/50">{t.empty}</p>}
              {data.categories.map((c, i) => (
                <div key={c.category || 'none'}>
                  <div className="mb-0.5 flex justify-between text-sm">
                    <span className="font-semibold">{c.category || ky.noCategory}</span>
                    <span className="text-white/60">
                      {c.correct}/{c.answered} · {c.accuracy}%
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${c.accuracy}%` }}
                      transition={{ delay: i * 0.06, type: 'spring', damping: 20 }}
                      className={`h-full rounded-full ${c.accuracy >= 70 ? 'bg-emerald-400' : c.accuracy >= 40 ? 'bg-ordo-gold' : 'bg-opt-a'}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Оюндар */}
        <section className="rounded-3xl bg-white/[0.06] p-5 ring-1 ring-white/10">
          <h2 className="mb-3 font-display text-xl font-bold">🎮 {t.gamesTitle}</h2>
          {data.games.length === 0 ? (
            <p className="text-white/50">{t.empty}</p>
          ) : (
            <div className="space-y-2">
              {data.games.map((g) => (
                <div key={g.gameId} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/5 px-4 py-3">
                  <span className="text-2xl">{g.place <= 3 ? ['🥇', '🥈', '🥉'][g.place - 1] : '🎖'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{g.title || t.untitled}</div>
                    <div className="text-sm text-white/50">
                      {fmtDate(g.date)} · {t.reached}: {ky.rounds[g.reached]} · {g.correct}/{g.answered}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-xl font-black text-ordo-gold-light">{g.total}</div>
                    <div className="text-xs text-white/50">{t.place(g.place, g.players)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {data.tasks.length > 0 && (
          <section className="rounded-3xl bg-white/[0.06] p-5 ring-1 ring-white/10">
            <h2 className="mb-3 font-display text-xl font-bold">📝 {t.tasksTitle}</h2>
            <div className="space-y-2">
              {data.tasks.map((x) => (
                <div key={x.assignmentId} className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{x.title}</div>
                    <div className="text-sm text-white/50">{fmtDate(x.date)}</div>
                  </div>
                  <div className="font-display text-lg font-black text-ordo-gold-light">{t.taskScore(x.correct, x.total)}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      <OrnamentBand flip />
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string | number; big?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/5 px-4 py-3">
      <div className={`font-display font-black text-ordo-gold-light ${big ? 'text-3xl' : 'text-xl'}`}>{value}</div>
      <div className="text-xs text-white/60">{label}</div>
    </div>
  );
}

/** Топтолгон упайдын сызыктуу графиги (SVG) */
function GrowthChart({ points }: { points: Profile['timeline'] }) {
  const W = 480;
  const H = 200;
  const pad = 28;
  const max = Math.max(1, ...points.map((p) => p.cumulative));
  const x = (i: number) => pad + (points.length === 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (points.length - 1));
  const y = (v: number) => H - pad - (v / max) * (H - 2 * pad);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.cumulative)}`).join(' ');
  const area = `${line} L${x(points.length - 1)},${H - pad} L${x(0)},${H - pad} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      <defs>
        <linearGradient id="growth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5b700" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#f5b700" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={pad} x2={W - pad} y1={y(max * f)} y2={y(max * f)} stroke="rgba(255,255,255,0.1)" />
          <text x={4} y={y(max * f) + 4} fontSize="11" fill="rgba(255,255,255,0.45)">
            {Math.round(max * f)}
          </text>
        </g>
      ))}
      <motion.path d={area} fill="url(#growth)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      <motion.path d={line} fill="none" stroke="#f5b700" strokeWidth="3" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.cumulative)} r="5" fill={p.kind === 'game' ? '#f5b700' : '#7fd3f7'} stroke="#0b1d3a" strokeWidth="2">
            <title>
              {fmtDate(p.date)} · {p.title ?? ''} · +{p.score}
            </title>
          </circle>
        </g>
      ))}
    </svg>
  );
}
