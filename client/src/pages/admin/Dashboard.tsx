import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SunTunduk } from '../../components/Ornament';
import { Button, Spinner, useDialogs } from '../../components/ui';
import { fmtDateTime, ky, type RoundKey } from '../../i18n/ky';
import { api, staffUser } from '../../lib/api';
import type { GameRow } from '../../lib/types';

type Summary = { round: RoundKey; count: number; required: number; ok: boolean };

export function ReadinessCards({ summary }: { summary: Summary[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {summary.map((s) => {
        const pct = Math.min(100, Math.round((s.count / Math.max(1, s.required)) * 100));
        return (
          <div key={s.round} className="card p-4">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white ${s.ok ? 'bg-emerald-500' : 'bg-ordo-red'}`}
              >
                {s.ok ? '✓' : '!'}
              </div>
              <div className="min-w-0">
                <div className="font-display font-bold">{ky.admin.dashboard.roundStatus(s.round, s.count)}</div>
                <div className={`text-sm font-semibold ${s.ok ? 'text-emerald-700' : 'text-ordo-red'}`}>
                  {s.ok ? ky.admin.dashboard.enough : ky.admin.dashboard.need(s.required - s.count)}
                </div>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ordo-ink/5">
              <motion.div
                className={`h-full rounded-full ${s.ok ? 'bg-emerald-500' : 'bg-gradient-to-r from-ordo-red to-ordo-gold'}`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  LOBBY: 'bg-ordo-sky/15 text-ordo-sky',
  ROUND1: 'bg-ordo-red/10 text-ordo-red',
  ROUND2: 'bg-ordo-red/10 text-ordo-red',
  FINAL: 'bg-ordo-gold/25 text-ordo-gold-dark',
  FINISHED: 'bg-emerald-100 text-emerald-700',
};

function Stat({ icon, value, label, tint, to }: { icon: string; value: number | null; label: string; tint: string; to: string }) {
  return (
    <Link to={to} className="card group flex flex-col items-start gap-3 p-4 transition sm:flex-row sm:items-center sm:gap-4 hover:-translate-y-0.5 hover:shadow-xl">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ${tint}`}>{icon}</div>
      <div className="min-w-0">
        <div className="font-display text-2xl leading-none font-black text-ordo-ink">{value ?? '—'}</div>
        <div className="mt-1 text-sm leading-tight font-semibold text-ordo-ink/55">{label}</div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { confirm, toast } = useDialogs();
  const user = staffUser.get();
  const d = ky.admin.dashboard;
  const [summary, setSummary] = useState<Summary[] | null>(null);
  const [games, setGames] = useState<GameRow[] | null>(null);
  const [students, setStudents] = useState<number | null>(null);
  const [openTasks, setOpenTasks] = useState<number | null>(null);

  const load = () => {
    api.get<{ summary: Summary[] }>('/api/questions/summary').then((r) => setSummary(r.summary)).catch((e) => toast(e.message, 'err'));
    api.get<{ games: GameRow[] }>('/api/games').then((r) => setGames(r.games)).catch((e) => toast(e.message, 'err'));
    api.get<{ students: unknown[] }>('/api/students').then((r) => setStudents(r.students.length)).catch(() => undefined);
    api
      .get<{ assignments: { open: boolean }[] }>('/api/assignments')
      .then((r) => setOpenTasks(r.assignments.filter((a) => a.open).length))
      .catch(() => undefined);
  };
  useEffect(load, [toast]);

  const remove = async (g: GameRow) => {
    if (!(await confirm({ title: d.deleteGame, message: d.deleteGameConfirm, danger: true, confirmText: ky.common.delete }))) return;
    await api.del(`/api/games/${g.id}`).catch((e) => toast(e.message, 'err'));
    load();
  };

  const totalQuestions = summary ? summary.reduce((a, s) => a + s.count, 0) : null;
  const finished = games ? games.filter((g) => g.status === 'FINISHED').length : null;
  const live = games?.filter((g) => g.status !== 'FINISHED') ?? [];
  const recent = games?.filter((g) => g.status === 'FINISHED').slice(0, 6) ?? [];

  const quick = [
    { icon: '➕', label: d.quickAddQuestion, to: '/admin/questions' },
    { icon: '📥', label: d.quickImport, to: '/admin/import' },
    { icon: '🎓', label: d.quickStudents, to: '/admin/students' },
    { icon: '📝', label: d.quickAssignment, to: '/admin/assignments' },
  ];

  const gameCard = (g: GameRow) => (
    <motion.div layout key={g.id} className="card flex items-center gap-4 p-4">
      <div className="rounded-2xl bg-ordo-night px-3 py-2.5 font-display text-lg font-bold tracking-widest text-ordo-gold">{g.code}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{g.title || ky.admin.history.untitled}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ordo-ink/50">
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[g.status] ?? ''}`}>{d.status[g.status]}</span>
          <span>{d.players(g._count?.players ?? 0)}</span>
          <span>· {fmtDateTime(g.createdAt)}</span>
        </div>
      </div>
      <Button variant="sky" onClick={() => navigate(`/admin/games/${g.id}`)}>
        {d.open}
      </Button>
      <button className="rounded-xl p-2 text-ordo-ink/30 hover:bg-ordo-red/10 hover:text-ordo-red" title={d.deleteGame} onClick={() => remove(g)}>
        🗑
      </button>
    </motion.div>
  );

  return (
    <div className="space-y-8">
      {/* Саламдашуу */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-night relative overflow-hidden rounded-3xl p-6 text-white shadow-xl md:p-8"
      >
                <div className="pointer-events-none absolute -right-10 -bottom-12 opacity-25">
          <SunTunduk size={220} />
        </div>
        <div className="relative z-10 flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <div className="text-sm font-semibold tracking-[0.25em] text-ordo-sky-light/80 uppercase">{ky.appName}</div>
            <h1 className="mt-2 font-display text-3xl font-black md:text-4xl">
              <span className="text-gold-gradient">{user ? d.hello(user.name) : d.title}</span>
            </h1>
            <p className="mt-3 text-white/70">{d.helloSub}</p>
          </div>
          <Button size="xl" variant="gold" icon="✨" onClick={() => navigate('/admin/games/new')}>
            {d.newGame}
          </Button>
        </div>
      </motion.section>

      {/* Сандар */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="❓" value={totalQuestions} label={d.statQuestions} tint="bg-ordo-sky/15" to="/admin/questions" />
        <Stat icon="🎓" value={students} label={d.statStudents} tint="bg-emerald-100" to="/admin/students" />
        <Stat icon="🏁" value={finished} label={d.statGames} tint="bg-ordo-gold/25" to="/admin/history" />
        <Stat icon="📝" value={openTasks} label={d.statAssignments} tint="bg-ordo-red/10" to="/admin/assignments" />
      </section>

      {/* Тез аракеттер */}
      <section>
        <h2 className="mb-3 font-display text-xl font-bold">{d.quick}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {quick.map((q) => (
            <Link
              key={q.to}
              to={q.to}
              className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-ordo-gold/40 bg-white/70 p-4 text-center font-semibold text-ordo-ink/80 transition hover:border-ordo-gold hover:bg-white hover:text-ordo-ink"
            >
              <span className="text-3xl">{q.icon}</span>
              <span className="text-sm">{q.label}</span>
            </Link>
          ))}
          <a
            href="/rating"
            target="_blank"
            rel="noreferrer"
            className="col-span-2 flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-ordo-gold/40 bg-white/70 p-4 text-center font-semibold text-ordo-ink/80 transition hover:border-ordo-gold hover:bg-white hover:text-ordo-ink md:col-span-1"
          >
            <span className="text-3xl">🏆</span>
            <span className="text-sm">{d.quickRating}</span>
          </a>
        </div>
      </section>

      {/* Даярдык */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">{d.readiness}</h2>
          <Link to="/admin/questions" className="font-semibold text-ordo-sky hover:underline">
            {ky.admin.nav.questions} →
          </Link>
        </div>
        {summary ? <ReadinessCards summary={summary} /> : <Spinner />}
      </section>

      {/* Оюндар */}
      {!games ? (
        <Spinner />
      ) : games.length === 0 ? (
        <section className="card flex flex-col items-center gap-4 p-10 text-center">
          <SunTunduk size={90} />
          <div className="font-display text-2xl font-bold">{d.emptyTitle}</div>
          <p className="max-w-md text-ordo-ink/60">{d.noGames}</p>
          <Button variant="red" icon="✨" onClick={() => navigate('/admin/games/new')}>
            {d.newGame}
          </Button>
        </section>
      ) : (
        <>
          {live.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ordo-red opacity-60" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-ordo-red" />
                </span>
                {d.live}
              </h2>
              <div className="grid gap-3 md:grid-cols-2">{live.map(gameCard)}</div>
            </section>
          )}
          {recent.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">{d.recent}</h2>
                <Link to="/admin/history" className="font-semibold text-ordo-sky hover:underline">
                  {d.allHistory}
                </Link>
              </div>
              <div className="grid gap-3 md:grid-cols-2">{recent.map(gameCard)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
