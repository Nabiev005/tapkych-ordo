import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Button, Modal, Spinner, useDialogs } from '../../components/ui';
import { ky } from '../../i18n/ky';
import { api } from '../../lib/api';
import type { Student } from '../../lib/types';

export default function Students() {
  const t = ky.admin.students;
  const { confirm, toast } = useDialogs();
  const [students, setStudents] = useState<Student[] | null>(null);
  const [query, setQuery] = useState('');
  const [cls, setCls] = useState('');
  const [edit, setEdit] = useState<{ id?: number; name: string; className: string } | null>(null);
  const [bulk, setBulk] = useState(false);
  const [lines, setLines] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    api
      .get<{ students: Student[] }>('/api/students')
      .then((r) => setStudents(r.students))
      .catch((e) => toast(e.message, 'err'));
  useEffect(() => {
    void load();
  }, []);

  const classes = useMemo(() => [...new Set((students ?? []).map((s) => s.className))].sort((a, b) => a.localeCompare(b, 'ky', { numeric: true })), [students]);
  const filtered = (students ?? []).filter(
    (s) => (!cls || s.className === cls) && (!query || s.name.toLocaleLowerCase('ky').includes(query.toLocaleLowerCase('ky'))),
  );
  const grouped = useMemo(() => {
    const m = new Map<string, Student[]>();
    for (const s of filtered) m.set(s.className, [...(m.get(s.className) ?? []), s]);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ky', { numeric: true }));
  }, [filtered]);

  const save = async () => {
    if (!edit?.name.trim()) return;
    setBusy(true);
    try {
      if (edit.id) await api.patch(`/api/students/${edit.id}`, { name: edit.name, className: edit.className });
      else await api.post('/api/students', { name: edit.name, className: edit.className });
      toast(ky.common.saved);
      setEdit(null);
      void load();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const addBulk = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ created: number }>('/api/students', { lines });
      toast(t.added(r.created));
      setBulk(false);
      setLines('');
      void load();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: Student) => {
    if (!(await confirm({ title: ky.common.delete, message: t.deleteConfirm(s.name), danger: true, confirmText: ky.common.delete }))) return;
    await api.del(`/api/students/${s.id}`).catch((e) => toast(e.message, 'err'));
    void load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black">{t.title}</h1>
          <p className="max-w-2xl text-ordo-ink/60">{t.hint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" icon="📋" onClick={() => setBulk(true)}>
            {t.bulkTitle}
          </Button>
          <Button variant="red" icon="＋" onClick={() => setEdit({ name: '', className: cls })}>
            {t.add}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input className="input max-w-xs py-2" placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {['', ...classes].map((c) => (
            <button
              key={c || 'all'}
              onClick={() => setCls(c)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${cls === c ? 'bg-ordo-red text-white' : 'bg-white text-ordo-ink/70 ring-1 ring-ordo-gold/30 hover:bg-ordo-gold/10'}`}
            >
              {c === '' ? t.allClasses : c || t.noClass}
            </button>
          ))}
        </div>
        {students && <span className="ml-auto text-sm text-ordo-ink/50">{t.count(filtered.length)}</span>}
      </div>

      {!students ? (
        <Spinner />
      ) : students.length === 0 ? (
        <div className="card p-10 text-center text-ordo-ink/60">{t.empty}</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([c, list]) => (
            <section key={c || 'none'}>
              <h2 className="mb-2 font-display text-lg font-bold">
                {c || t.noClass} <span className="text-sm font-normal text-ordo-ink/40">· {t.count(list.length)}</span>
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {list.map((s) => (
                    <motion.div layout key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card group flex items-center gap-3 p-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ordo-night font-display font-bold text-ordo-gold">
                        {s.name.slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{s.name}</div>
                        <div className="text-xs text-ordo-ink/50">{t.games(s._count?.players ?? 0)}</div>
                      </div>
                      <div className="flex opacity-50 transition group-hover:opacity-100">
                        <button title={t.edit} className="rounded-lg p-1.5 hover:bg-ordo-gold/20" onClick={() => setEdit({ id: s.id, name: s.name, className: s.className })}>
                          ✏️
                        </button>
                        <button title={ky.common.delete} className="rounded-lg p-1.5 hover:bg-ordo-red/10" onClick={() => remove(s)}>
                          🗑
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? t.edit : t.add}>
        {edit && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div>
              <label className="label">{t.name}</label>
              <input className="input" autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </div>
            <div>
              <label className="label">{t.className}</label>
              <input className="input" placeholder={t.classPlaceholder} list="class-list" value={edit.className} onChange={(e) => setEdit({ ...edit, className: e.target.value })} />
              <datalist id="class-list">
                {classes.filter(Boolean).map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" size="lg" onClick={() => setEdit(null)}>
                {ky.common.cancel}
              </Button>
              <Button type="submit" variant="green" size="lg" loading={busy} disabled={!edit.name.trim()}>
                {ky.common.save}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={bulk} onClose={() => setBulk(false)} title={t.bulkTitle}>
        <p className="mb-3 text-sm text-ordo-ink/60">{t.bulkHint}</p>
        <textarea className="input min-h-60 font-medium leading-7" placeholder={t.bulkPlaceholder} value={lines} onChange={(e) => setLines(e.target.value)} autoFocus />
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="outline" size="lg" onClick={() => setBulk(false)}>
            {ky.common.cancel}
          </Button>
          <Button variant="green" size="lg" loading={busy} disabled={!lines.trim()} onClick={addBulk}>
            {t.bulkAdd}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
