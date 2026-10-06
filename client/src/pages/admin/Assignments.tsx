import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal, Spinner, useDialogs } from '../../components/ui';
import { fmtDateTime, ky, type Difficulty } from '../../i18n/ky';
import { api } from '../../lib/api';
import { DIFFICULTIES, type AssignmentRow, type Question } from '../../lib/types';
import { QuestionBadges } from './Questions';

interface Form {
  title: string;
  timerSeconds: number;
  closesAt: string;
  mode: 'auto' | 'manual';
  count: number;
  categories: string[];
  difficulty: Difficulty | '';
  includeArchived: boolean;
  ids: number[];
}

export default function Assignments() {
  const t = ky.admin.assignments;
  const navigate = useNavigate();
  const { toast } = useDialogs();
  const [list, setList] = useState<AssignmentRow[] | null>(null);
  const [bank, setBank] = useState<Question[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    api
      .get<{ assignments: AssignmentRow[] }>('/api/assignments')
      .then((r) => setList(r.assignments))
      .catch((e) => toast(e.message, 'err'));
  useEffect(() => {
    void load();
    api
      .get<{ questions: Question[] }>('/api/questions')
      .then((r) => setBank(r.questions))
      .catch(() => undefined);
  }, []);

  const categories = useMemo(() => [...new Set(bank.map((q) => q.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ky')), [bank]);
  const available = form
    ? bank.filter(
        (q) =>
          (form.includeArchived || !q.archived) &&
          (!form.categories.length || form.categories.includes(q.category)) &&
          (!form.difficulty || q.difficulty === form.difficulty),
      )
    : [];

  const create = async () => {
    if (!form) return;
    setBusy(true);
    try {
      const body = {
        title: form.title,
        timerSeconds: form.timerSeconds,
        closesAt: form.closesAt ? new Date(form.closesAt).toISOString() : null,
        ...(form.mode === 'manual'
          ? { questionIds: form.ids }
          : { auto: { count: form.count, categories: form.categories, difficulty: form.difficulty || undefined, includeArchived: form.includeArchived } }),
      };
      const r = await api.post<{ assignment: { id: number } }>('/api/assignments', body);
      navigate(`/admin/assignments/${r.assignment.id}`);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const valid = !!form && form.title.trim() && (form.mode === 'manual' ? form.ids.length > 0 : form.count > 0 && available.length > 0);
  const chip = (on: boolean) => `rounded-full px-3 py-1 text-sm font-semibold ${on ? 'bg-ordo-red text-white' : 'bg-white ring-1 ring-ordo-gold/30 hover:bg-ordo-gold/10'}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black">{t.title}</h1>
          <p className="max-w-3xl text-ordo-ink/60">{t.hint}</p>
        </div>
        <Button
          variant="red"
          icon="＋"
          onClick={() => setForm({ title: '', timerSeconds: 30, closesAt: '', mode: 'auto', count: 10, categories: [], difficulty: '', includeArchived: false, ids: [] })}
        >
          {t.create}
        </Button>
      </div>

      {!list ? (
        <Spinner />
      ) : list.length === 0 ? (
        <div className="card p-10 text-center text-ordo-ink/60">{t.empty}</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((a, i) => (
            <motion.button
              key={a.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => navigate(`/admin/assignments/${a.id}`)}
              className="card p-5 text-left transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-display text-lg font-bold">📝 {a.title}</div>
                  <div className="text-sm text-ordo-ink/50">{fmtDateTime(a.createdAt)}</div>
                </div>
                <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${a.open ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                  {a.open ? ky.common.active : ky.common.closed}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-ordo-ink/70">{t.stats(a.questions, a.finished, a.started)}</span>
                <span className="rounded-lg bg-ordo-night px-2.5 py-0.5 font-mono text-sm font-bold tracking-widest text-ordo-gold">{a.code}</span>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={t.create} wide>
        {form && (
          <div className="space-y-4">
            <div>
              <label className="label">{t.titleLabel}</label>
              <input className="input" autoFocus placeholder={t.titlePlaceholder} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">{t.timer}</label>
                <input type="number" min={10} max={300} className="input" value={form.timerSeconds} onChange={(e) => setForm({ ...form, timerSeconds: Math.max(10, Math.min(300, Number(e.target.value) || 30)) })} />
              </div>
              <div>
                <label className="label">{t.closesAt}</label>
                <input type="datetime-local" className="input" value={form.closesAt} onChange={(e) => setForm({ ...form, closesAt: e.target.value })} />
              </div>
            </div>

            {/* Чыпкалар (эки режимде тең) */}
            {categories.length > 0 && (
              <div>
                <label className="label">{t.categories}</label>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c) => {
                    const on = form.categories.includes(c);
                    return (
                      <button key={c} onClick={() => setForm({ ...form, categories: on ? form.categories.filter((x) => x !== c) : [...form.categories, c] })} className={chip(on)}>
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="label mb-0">{t.difficulty}:</span>
              {(['', ...DIFFICULTIES] as (Difficulty | '')[]).map((d) => (
                <button key={d || 'any'} onClick={() => setForm({ ...form, difficulty: d })} className={chip(form.difficulty === d)}>
                  {d ? ky.difficulty[d] : t.anyDifficulty}
                </button>
              ))}
              <label className="ml-auto flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.includeArchived} onChange={(e) => setForm({ ...form, includeArchived: e.target.checked })} />
                {t.includeArchived}
              </label>
            </div>

            <div>
              <label className="label">{t.mode}</label>
              <div className="grid grid-cols-2 gap-2">
                {(['auto', 'manual'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setForm({ ...form, mode: m })}
                    className={`rounded-2xl border-2 py-2.5 font-semibold ${form.mode === m ? 'border-ordo-sky bg-ordo-sky/10' : 'border-ordo-gold/20'}`}
                  >
                    {m === 'auto' ? `🎲 ${t.modeAuto}` : `☑️ ${t.modeManual}`}
                  </button>
                ))}
              </div>
            </div>

            {form.mode === 'auto' ? (
              <div className="flex items-center gap-3">
                <label className="label mb-0">{t.count}</label>
                <input type="number" min={1} max={100} className="input w-28" value={form.count} onChange={(e) => setForm({ ...form, count: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })} />
                <span className="text-sm text-ordo-ink/50">/ {available.length}</span>
              </div>
            ) : (
              <div>
                <div className="mb-2 text-sm font-semibold text-ordo-ink/70">{t.selected(form.ids.length)}</div>
                <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                  {available.map((q) => {
                    const on = form.ids.includes(q.id);
                    return (
                      <button
                        key={q.id}
                        onClick={() => setForm({ ...form, ids: on ? form.ids.filter((x) => x !== q.id) : [...form.ids, q.id] })}
                        className={`flex w-full items-start gap-3 rounded-xl border-2 p-2.5 text-left ${on ? 'border-emerald-500 bg-emerald-50' : 'border-ordo-gold/15 bg-white'}`}
                      >
                        <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-sm font-bold ${on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'}`}>
                          {on ? form.ids.indexOf(q.id) + 1 : ''}
                        </span>
                        <span className="min-w-0 flex-1">
                          <QuestionBadges q={q} />
                          <span className="mt-0.5 block text-sm font-semibold">{q.text}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="lg" onClick={() => setForm(null)}>
                {ky.common.cancel}
              </Button>
              <Button variant="green" size="lg" loading={busy} disabled={!valid} onClick={create}>
                {t.createBtn}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
