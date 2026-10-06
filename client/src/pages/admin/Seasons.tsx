import { useEffect, useState } from 'react';
import { Button, Modal, Spinner, useDialogs } from '../../components/ui';
import { fmtDate, ky } from '../../i18n/ky';
import { api } from '../../lib/api';
import type { Season } from '../../lib/types';

const day = (d: string) => d.slice(0, 10);

/** Рейтингдин сезондору (башкы алып баруучу гана түзөт) */
export default function Seasons() {
  const t = ky.admin.seasons;
  const { confirm, toast } = useDialogs();
  const [list, setList] = useState<Season[] | null>(null);
  const [form, setForm] = useState<{ id?: number; name: string; startsAt: string; endsAt: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    api
      .get<{ seasons: Season[] }>('/api/seasons')
      .then((r) => setList(r.seasons))
      .catch((e) => toast(e.message, 'err'));
  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!form) return;
    setBusy(true);
    try {
      const body = { name: form.name, startsAt: form.startsAt, endsAt: form.endsAt };
      if (form.id) await api.patch(`/api/seasons/${form.id}`, body);
      else await api.post('/api/seasons', body);
      toast(ky.common.saved);
      setForm(null);
      void load();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const now = new Date().toISOString();
  const valid = !!form && form.name.trim() && form.startsAt && form.endsAt && form.endsAt >= form.startsAt;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black">{t.title}</h1>
          <p className="max-w-3xl text-ordo-ink/60">{t.hint}</p>
        </div>
        <Button variant="red" icon="＋" onClick={() => setForm({ name: '', startsAt: today, endsAt: today })}>
          {t.add}
        </Button>
      </div>

      {!list ? (
        <Spinner />
      ) : list.length === 0 ? (
        <div className="card p-10 text-center text-ordo-ink/60">{t.empty}</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((x) => {
            const current = x.startsAt <= now && now <= x.endsAt;
            return (
              <div key={x.id} className={`card p-5 ${current ? 'ring-2 ring-emerald-400' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-lg font-bold">
                      📅 {x.name} {current && <span className="ml-1 rounded bg-emerald-100 px-2 text-xs font-bold text-emerald-700">{t.current}</span>}
                    </div>
                    <div className="text-sm text-ordo-ink/55">
                      {fmtDate(x.startsAt)} — {fmtDate(x.endsAt)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button className="rounded-lg p-1.5 hover:bg-ordo-gold/20" title={ky.common.edit} onClick={() => setForm({ id: x.id, name: x.name, startsAt: day(x.startsAt), endsAt: day(x.endsAt) })}>
                      ✏️
                    </button>
                    <button
                      className="rounded-lg p-1.5 hover:bg-ordo-red/10"
                      title={ky.common.delete}
                      onClick={async () => {
                        if (!(await confirm({ title: ky.common.delete, message: t.deleteConfirm(x.name), danger: true, confirmText: ky.common.delete }))) return;
                        await api.del(`/api/seasons/${x.id}`).catch((e) => toast(e.message, 'err'));
                        void load();
                      }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="sky" onClick={() => window.open(`/rating?season=${x.id}`, '_blank')}>
                    🏆 {t.openRating}
                  </Button>
                  <Button size="sm" variant="gold" onClick={() => window.open(`/certificate?season=${x.id}&top=3`, '_blank')}>
                    📜 {t.certificates}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? ky.common.edit : t.add}>
        {form && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) void save();
            }}
          >
            <div>
              <label className="label">{t.name}</label>
              <input className="input" autoFocus placeholder={t.namePlaceholder} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t.startsAt}</label>
                <input type="date" className="input" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
              </div>
              <div>
                <label className="label">{t.endsAt}</label>
                <input type="date" className="input" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" size="lg" onClick={() => setForm(null)}>
                {ky.common.cancel}
              </Button>
              <Button type="submit" variant="green" size="lg" loading={busy} disabled={!valid}>
                {ky.common.save}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
