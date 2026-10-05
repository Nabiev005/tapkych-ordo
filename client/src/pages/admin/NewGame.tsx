import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, useDialogs } from '../../components/ui';
import { ky, type RoundKey } from '../../i18n/ky';
import { api } from '../../lib/api';
import type { GameRow, Settings, Student } from '../../lib/types';

const DEFAULTS: Omit<Settings, 'soundEnabled'> = {
  pointsPerCorrect: 1,
  timerSeconds: 15,
  round1Count: 10,
  round2Count: 10,
  finalQuestionCount: 5,
  advanceToRound2: 6,
  advanceToFinal: 3,
  expectedPlayers: 12,
};

const FIELDS: { key: keyof typeof DEFAULTS; min: number; max: number }[] = [
  { key: 'pointsPerCorrect', min: 1, max: 100 },
  { key: 'timerSeconds', min: 5, max: 120 },
  { key: 'expectedPlayers', min: 2, max: 100 },
  { key: 'round1Count', min: 1, max: 50 },
  { key: 'round2Count', min: 1, max: 50 },
  { key: 'finalQuestionCount', min: 1, max: 50 },
  { key: 'advanceToRound2', min: 2, max: 100 },
  { key: 'advanceToFinal', min: 1, max: 100 },
];

export default function NewGame() {
  const t = ky.admin.newGame;
  const ts = ky.admin.students;
  const navigate = useNavigate();
  const { toast } = useDialogs();
  const [title, setTitle] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [query, setQuery] = useState('');
  const [cls, setCls] = useState('');
  const [quick, setQuick] = useState({ name: '', className: '' });
  const [s, setS] = useState(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [bank, setBank] = useState<Record<RoundKey, number> | null>(null);

  const loadStudents = () =>
    api
      .get<{ students: Student[] }>('/api/students')
      .then((r) => setStudents(r.students))
      .catch((e) => toast(e.message, 'err'));

  useEffect(() => {
    void loadStudents();
    api
      .get<{ summary: { round: RoundKey; count: number }[] }>('/api/questions/summary')
      .then((r) => setBank(Object.fromEntries(r.summary.map((x) => [x.round, x.count])) as Record<RoundKey, number>))
      .catch(() => undefined);
  }, []);

  const classes = useMemo(() => [...new Set(students.map((x) => x.className))].sort((a, b) => a.localeCompare(b, 'ky', { numeric: true })), [students]);
  const visible = students.filter(
    (x) => (!cls || x.className === cls) && (!query || x.name.toLocaleLowerCase('ky').includes(query.toLocaleLowerCase('ky'))),
  );
  const chosen = selected.map((id) => students.find((x) => x.id === id)).filter((x): x is Student => !!x);
  const toggle = (id: number) => setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));

  const quickAdd = async () => {
    if (!quick.name.trim()) return;
    try {
      const r = await api.post<{ students: Student[] }>('/api/students', quick);
      const st = r.students[0];
      await loadStudents();
      if (st) setSelected((sel) => (sel.includes(st.id) ? sel : [...sel, st.id]));
      setQuick({ name: '', className: quick.className });
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  const need: Record<RoundKey, number> = { ROUND1: s.round1Count, ROUND2: s.round2Count, FINAL: s.finalQuestionCount };
  const lacking = bank ? (Object.keys(need) as RoundKey[]).filter((r) => bank[r] < need[r]) : [];

  const create = async () => {
    if (selected.length < 2) return toast(t.needPlayers, 'err');
    setBusy(true);
    try {
      const { game } = await api.post<{ game: GameRow }>('/api/games', { title: title.trim() || undefined, students: selected, settings: s });
      navigate(`/admin/games/${game.id}`);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate('/admin')}>
          ← {ky.common.back}
        </Button>
        <h1 className="font-display text-2xl font-black">{t.title}</h1>
      </div>

      <section className="card p-5">
        <label className="label">{t.gameTitle}</label>
        <input className="input text-xl font-semibold" placeholder={t.gameTitlePlaceholder} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Окуучуларды тандоо */}
        <section className="card space-y-4 p-5 lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold">👥 {t.pickTitle}</h2>
            <Link to="/admin/students" className="text-sm font-semibold text-ordo-sky hover:underline">
              {t.manageStudents} →
            </Link>
          </div>
          <p className="text-sm text-ordo-ink/60">{t.pickHint}</p>

          <div className="flex flex-wrap gap-2">
            <input className="input max-w-56 py-2" placeholder={ts.search} value={query} onChange={(e) => setQuery(e.target.value)} />
            {['', ...classes].map((c) => (
              <button
                key={c || 'all'}
                onClick={() => setCls(c)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${cls === c ? 'bg-ordo-red text-white' : 'bg-white ring-1 ring-ordo-gold/30 hover:bg-ordo-gold/10'}`}
              >
                {c === '' ? ts.allClasses : c || ts.noClass}
              </button>
            ))}
          </div>

          {cls && visible.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelected((sel) => [...sel, ...visible.map((x) => x.id).filter((id) => !sel.includes(id))])}
            >
              ✓ {t.selectAllClass(cls)}
            </Button>
          )}

          {students.length === 0 ? (
            <div className="rounded-2xl bg-ordo-gold/15 p-4 text-ordo-ink/70">{t.noStudents}</div>
          ) : (
            <div className="grid max-h-[420px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {visible.map((x) => {
                const on = selected.includes(x.id);
                return (
                  <button
                    key={x.id}
                    onClick={() => toggle(x.id)}
                    className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${on ? 'border-emerald-500 bg-emerald-50' : 'border-ordo-gold/20 bg-white hover:border-ordo-gold'}`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 font-bold ${on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'}`}>
                      {on ? '✓' : ''}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{x.name}</span>
                    {x.className && <span className="shrink-0 rounded-md bg-ordo-ink/5 px-2 text-xs font-bold text-ordo-ink/60">{x.className}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Тизмеде жок окуучуну тез кошуу */}
          <div className="rounded-2xl bg-ordo-cream p-3">
            <div className="mb-2 text-sm font-semibold text-ordo-ink/70">
              ＋ {t.quickAdd} <span className="font-normal text-ordo-ink/45">— {t.quickAddHint}</span>
            </div>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void quickAdd();
              }}
            >
              <input className="input min-w-48 flex-1 py-2" placeholder={ts.name} value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} />
              <input className="input w-28 py-2" placeholder={ts.classPlaceholder} value={quick.className} onChange={(e) => setQuick({ ...quick, className: e.target.value })} />
              <Button type="submit" variant="sky" disabled={!quick.name.trim()}>
                {ky.common.add}
              </Button>
            </form>
          </div>
        </section>

        {/* Тандалгандар + жөндөөлөр */}
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className={`font-display text-lg font-bold ${selected.length === s.expectedPlayers ? 'text-emerald-600' : ''}`}>{t.selected(selected.length, s.expectedPlayers)}</h2>
              {selected.length > 0 && (
                <button className="text-sm font-semibold text-ordo-ink/40 hover:text-ordo-red" onClick={() => setSelected([])}>
                  {t.clearSelection}
                </button>
              )}
            </div>
            <ol className="space-y-1.5">
              <AnimatePresence>
                {chosen.map((x, i) => (
                  <motion.li
                    layout
                    key={x.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2"
                  >
                    <span className="w-6 text-right font-display font-bold text-ordo-ink/40">{i + 1}</span>
                    <span className="flex-1 truncate font-semibold">{x.name}</span>
                    {x.className && <span className="text-xs font-bold text-ordo-ink/50">{x.className}</span>}
                    <button className="rounded-lg px-1.5 text-ordo-ink/40 hover:bg-ordo-red/10 hover:text-ordo-red" onClick={() => toggle(x.id)}>
                      ✕
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="font-display text-lg font-bold">⚙️ {t.settings}</h2>
            <p className="text-sm text-ordo-ink/60">{t.settingsHint}</p>
            <div className="space-y-3">
              {FIELDS.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-3">
                  <label className="text-sm font-semibold text-ordo-ink/70">{t[f.key]}</label>
                  <input
                    type="number"
                    className="input w-24 py-2 text-center"
                    min={f.min}
                    max={f.max}
                    value={s[f.key]}
                    onChange={(e) => setS({ ...s, [f.key]: Math.max(f.min, Math.min(f.max, Number(e.target.value) || f.min)) })}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {lacking.length > 0 && (
        <div className="rounded-2xl bg-ordo-gold/20 p-4 text-ordo-ink">
          ⚠ {t.bankWarn}
          <ul className="mt-1 list-disc pl-6">
            {lacking.map((r) => (
              <li key={r}>{ky.notEnoughQuestions(r, need[r], bank![r])}</li>
            ))}
          </ul>
        </div>
      )}

      <Button size="xl" variant="red" className="w-full" loading={busy} disabled={selected.length < 2} onClick={create}>
        {busy ? t.creating : t.create}
      </Button>
    </div>
  );
}
