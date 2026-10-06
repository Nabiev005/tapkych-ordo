import { useEffect, useState } from 'react';
import { Button, Modal, Spinner, useDialogs } from '../../components/ui';
import { ky } from '../../i18n/ky';
import { api } from '../../lib/api';
import type { Teacher } from '../../lib/types';

/** Мугалимдердин аккаунттары (башкы алып баруучу гана) */
export default function Teachers() {
  const t = ky.admin.teachers;
  const { confirm, prompt, toast } = useDialogs();
  const [list, setList] = useState<Teacher[] | null>(null);
  const [form, setForm] = useState<{ name: string; username: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    api
      .get<{ teachers: Teacher[] }>('/api/teachers')
      .then((r) => setList(r.teachers))
      .catch((e) => toast(e.message, 'err'));
  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    if (!form) return;
    setBusy(true);
    try {
      await api.post('/api/teachers', form);
      toast(t.created);
      setForm(null);
      void load();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const valid = !!form && form.name.trim() && /^[a-zA-Z0-9._-]{3,30}$/.test(form.username.trim()) && form.password.trim().length >= 6;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black">{t.title}</h1>
          <p className="max-w-3xl text-ordo-ink/60">{t.hint}</p>
        </div>
        <Button variant="red" icon="＋" onClick={() => setForm({ name: '', username: '', password: '' })}>
          {t.add}
        </Button>
      </div>

      {!list ? (
        <Spinner />
      ) : list.length === 0 ? (
        <div className="card p-10 text-center text-ordo-ink/60">{t.empty}</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((x) => (
            <div key={x.id} className="card flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ordo-sky font-display text-xl font-bold text-white">{x.name.slice(0, 1)}</div>
              <div className="min-w-0 flex-1">
                <div className="font-display font-bold">{x.name}</div>
                <div className="font-mono text-sm text-ordo-ink/60">{x.username}</div>
                <div className="text-xs text-ordo-ink/45">{t.stats(x._count.questions, x._count.games, x._count.assignments)}</div>
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const password = await prompt({ title: `${t.resetPassword}: ${x.name}`, label: t.newPassword, confirmText: ky.common.save });
                    if (!password) return;
                    try {
                      await api.patch(`/api/teachers/${x.id}`, { password });
                      toast(t.passwordChanged);
                    } catch (e) {
                      toast((e as Error).message, 'err');
                    }
                  }}
                >
                  🔑 {t.resetPassword}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    if (!(await confirm({ title: ky.common.delete, message: t.deleteConfirm(x.name), danger: true, confirmText: ky.common.delete }))) return;
                    await api.del(`/api/teachers/${x.id}`).catch((e) => toast(e.message, 'err'));
                    void load();
                  }}
                >
                  🗑 {ky.common.delete}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={t.add}>
        {form && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) void create();
            }}
          >
            <div>
              <label className="label">{t.name}</label>
              <input className="input" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">{t.username}</label>
              <input className="input font-mono" autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s/g, '') })} />
            </div>
            <div>
              <label className="label">{t.password}</label>
              <input className="input font-mono" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
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
