import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { JoinQr } from '../../components/game';
import { Button, Spinner, useDialogs } from '../../components/ui';
import { fmtDateTime, ky } from '../../i18n/ky';
import { api, downloadFile, getJoinBase } from '../../lib/api';
import type { AssignmentDetail as Detail } from '../../lib/types';

export default function AssignmentDetail() {
  const t = ky.admin.assignments;
  const { id } = useParams();
  const navigate = useNavigate();
  const { confirm, toast } = useDialogs();
  const [a, setA] = useState<Detail | null>(null);
  const [base, setBase] = useState('');

  const load = () =>
    api
      .get<{ assignment: Detail }>(`/api/assignments/${id}`)
      .then((r) => setA(r.assignment))
      .catch((e) => toast(e.message, 'err'));
  useEffect(() => {
    void load();
    void getJoinBase().then(setBase);
    // Жыйынтыктар жаңырып турсун
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [id]);

  if (!a)
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-10 w-10 text-ordo-red" />
      </div>
    );

  const link = `${base}/hw/${a.code}`;
  const sec = (ms: number) => `${Math.round(ms / 1000)} с`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={() => navigate('/admin/assignments')}>
          ← {ky.common.back}
        </Button>
        <h1 className="flex-1 font-display text-2xl font-black">📝 {a.title}</h1>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${a.open ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
          {a.open ? ky.common.active : ky.common.closed}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="flex flex-col items-center gap-3 rounded-3xl bg-night p-6 text-center text-white shadow-xl">
          <div className="text-sm font-semibold uppercase tracking-widest text-ordo-sky-light">{t.link}</div>
          {base && <JoinQr url={link} size={170} />}
          <div className="break-all font-mono text-ordo-gold-light">{link}</div>
          <div className="font-display text-4xl font-black tracking-[0.2em] text-gold-gradient">{a.code}</div>
          <div className="grid w-full grid-cols-2 gap-2">
            <Button
              variant="dark"
              size="sm"
              onClick={() =>
                navigator.clipboard
                  ?.writeText(link)
                  .then(() => toast(ky.common.copied))
                  .catch(() => undefined)
              }
            >
              🔗 {ky.common.copyLink}
            </Button>
            <Button
              variant={a.active ? 'outline' : 'green'}
              size="sm"
              onClick={async () => {
                await api.patch(`/api/assignments/${a.id}`, { active: !a.active }).catch((e) => toast(e.message, 'err'));
                void load();
              }}
            >
              {a.active ? `🔒 ${t.close}` : `🔓 ${t.reopen}`}
            </Button>
          </div>
          {a.closesAt && <div className="text-sm text-white/60">{ky.homework.closesAt(fmtDateTime(a.closesAt))}</div>}
        </section>

        <section className="card p-5 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold">{t.results}</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="green" icon="📊" onClick={() => downloadFile(`/api/assignments/${a.id}/export.xlsx`, ky.files.assignment(a.code)).catch((e) => toast(e.message, 'err'))}>
                {t.export}
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={async () => {
                  if (!(await confirm({ title: ky.common.delete, message: t.deleteConfirm(a.title), danger: true, confirmText: ky.common.delete }))) return;
                  await api.del(`/api/assignments/${a.id}`).catch((e) => toast(e.message, 'err'));
                  navigate('/admin/assignments');
                }}
              >
                🗑
              </Button>
            </div>
          </div>
          {a.submissions.length === 0 ? (
            <p className="py-8 text-center text-ordo-ink/50">{t.noResults}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="border-b-2 border-ordo-gold/30 text-sm text-ordo-ink/50">
                    <th className="p-2">#</th>
                    <th className="p-2">{t.name}</th>
                    <th className="p-2">{t.className}</th>
                    <th className="p-2 text-center">{t.score}</th>
                    <th className="p-2 text-center">{t.time}</th>
                    <th className="p-2">{t.status}</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {a.submissions.map((s, i) => (
                    <tr key={s.id} className="border-b border-ordo-gold/10">
                      <td className="p-2 font-display font-bold">{s.finishedAt ? (i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1) : '…'}</td>
                      <td className="p-2 font-semibold">{s.name}</td>
                      <td className="p-2 text-ordo-ink/60">{s.className}</td>
                      <td className="p-2 text-center font-display font-black text-ordo-red">
                        {s.correct}/{s.total}
                      </td>
                      <td className="p-2 text-center text-sm tabular-nums">{sec(s.durationMs)}</td>
                      <td className="p-2 text-sm">
                        {s.finishedAt ? (
                          <span className="text-emerald-700">✓ {t.done}</span>
                        ) : (
                          <span className="text-amber-700">
                            ⏳ {t.inProgress} ({s.answered}/{s.total})
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-right">
                        <button
                          className="rounded-lg px-2 py-0.5 text-xs font-semibold text-ordo-sky hover:bg-ordo-sky/10"
                          onClick={async () => {
                            if (!(await confirm({ title: t.allowRetry, message: t.retryConfirm(s.name) }))) return;
                            await api.del(`/api/assignments/${a.id}/submissions/${s.id}`).catch((e) => toast(e.message, 'err'));
                            void load();
                          }}
                        >
                          ↺ {t.allowRetry}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="card p-5">
        <h2 className="mb-3 font-display text-lg font-bold">{t.questionsTitle}</h2>
        <ol className="space-y-1.5">
          {a.questions.map((q) => (
            <li key={q.id} className="flex gap-3 rounded-xl px-2 py-1.5 odd:bg-ordo-cream">
              <span className="w-6 text-right font-bold text-ordo-ink/40">{q.order + 1}</span>
              <span className="flex-1">{q.text}</span>
              <span className="shrink-0 text-sm font-bold text-emerald-700">✓ {q.correctLabel}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
