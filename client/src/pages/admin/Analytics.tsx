import { motion } from 'framer-motion';
import { ChartColumn, CircleCheck, Flame, KeyRound, Target, TrendingDown, UserCheck, UserX, Users, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Spinner, useDialogs } from '../../components/ui';
import { ky } from '../../i18n/ky';
import { api } from '../../lib/api';
import type { StudentStatus, TeacherAnalytics } from '../../lib/types';

type Row = TeacherAnalytics['students'][number];
type Filter = 'all' | 'attention' | 'active';

/** Көңүл буруу тартиби: токтоп калгандар (жакында токтогондор биринчи) → кирбегендер → коду жоктор → активдүүлөр */
const ORDER: Record<StudentStatus, number> = { STOPPED: 0, NEVER: 1, NO_CODE: 2, ACTIVE: 3 };

const STATUS_STYLE: Record<StudentStatus, { cls: string; icon: LucideIcon }> = {
  ACTIVE: { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: UserCheck },
  STOPPED: { cls: 'bg-rose-50 text-rose-700 ring-rose-200', icon: TrendingDown },
  NEVER: { cls: 'bg-amber-50 text-amber-800 ring-amber-200', icon: UserX },
  NO_CODE: { cls: 'bg-ordo-ink/5 text-ordo-ink/60 ring-ordo-ink/10', icon: KeyRound },
};

/** Тема боюнча тактыктын деңгээли: түс ар дайым жазуу менен кошо көрсөтүлөт */
function level(acc: number | null) {
  const t = ky.admin.analytics;
  if (acc === null) return { bar: 'bg-ordo-ink/15', text: 'text-ordo-ink/45', label: t.few };
  if (acc < 50) return { bar: 'bg-rose-500', text: 'text-rose-700', label: t.weakLabel };
  if (acc < 75) return { bar: 'bg-amber-400', text: 'text-amber-800', label: t.okLabel };
  return { bar: 'bg-emerald-500', text: 'text-emerald-700', label: t.strongLabel };
}

export default function Analytics() {
  const t = ky.admin.analytics;
  const { toast } = useDialogs();
  const [cls, setCls] = useState('');
  const [data, setData] = useState<TeacherAnalytics | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    setData(null);
    api
      .get<TeacherAnalytics>(`/api/students/analytics?className=${encodeURIComponent(cls)}`)
      .then(setData)
      .catch((e) => toast(e.message, 'err'));
  }, [cls]);

  const rows = useMemo(() => {
    const list = (data?.students ?? []).filter((r) => (filter === 'all' ? true : filter === 'active' ? r.status === 'ACTIVE' : r.status !== 'ACTIVE'));
    return list.sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.daysAgo ?? 0) - (b.daysAgo ?? 0) || a.name.localeCompare(b.name, 'ky'));
  }, [data, filter]);

  const s = data?.summary;
  const attention = s ? s.stopped + s.never : 0;

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-black">
          <ChartColumn className="ico text-ordo-gold" /> {t.title}
        </h1>
        <p className="max-w-2xl text-ordo-ink/60">{t.hint}</p>
      </div>

      {data && data.classes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {['', ...data.classes].map((c) => (
            <button
              key={c || 'all'}
              onClick={() => setCls(c)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${cls === c ? 'bg-ordo-red text-white' : 'bg-white text-ordo-ink/70 ring-1 ring-ordo-gold/30 hover:bg-ordo-gold/10'}`}
            >
              {c || t.allClasses}
            </button>
          ))}
        </div>
      )}

      {!data || !s ? (
        <Spinner />
      ) : s.members === 0 ? (
        <div className="card p-10 text-center text-ordo-ink/60">{t.empty}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Tile icon={<Users />} label={t.members} value={s.members} hint={t.withCode(s.withCode)} />
            <Tile icon={<UserCheck />} label={t.activeWeek} value={`${s.activeWeek}/${s.members}`} />
            <Tile icon={<TrendingDown />} label={t.stopped} value={s.stopped} hint={t.stoppedHint(3)} tone={s.stopped ? 'warn' : undefined} />
            <Tile icon={<UserX />} label={t.never} value={s.never} tone={s.never ? 'warn' : undefined} />
            <Tile icon={<Target />} label={t.accuracyWeek} value={s.accuracyWeek === null ? t.noData : `${s.accuracyWeek}%`} />
          </div>

          <div className="grid min-w-0 gap-6 2xl:grid-cols-5">
            <section className="card min-w-0 p-5 2xl:col-span-2">
              <h2 className="font-display text-lg font-bold">{t.topicsTitle}</h2>
              <p className="mb-4 text-sm text-ordo-ink/55">{t.topicsHint}</p>
              {data.topics.length === 0 ? (
                <p className="text-sm text-ordo-ink/55">{t.topicsEmpty}</p>
              ) : (
                <ul className="grid gap-x-8 gap-y-3 lg:grid-cols-2 2xl:grid-cols-1">
                  {data.topics.map((tp, i) => {
                    const lv = level(tp.accuracy);
                    return (
                      <li key={tp.category} title={`${tp.category}: ${tp.correct}/${tp.answered}`}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate font-semibold">{tp.category}</span>
                          <span className="shrink-0 tabular-nums">
                            <span className={`mr-2 text-xs font-semibold ${lv.text}`}>{lv.label}</span>
                            <span className="font-display font-black">{tp.accuracy === null ? t.noData : `${tp.accuracy}%`}</span>
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-ordo-ink/5">
                          <motion.div
                            className={`h-full rounded-full ${lv.bar}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${tp.accuracy ?? Math.round((tp.correct / tp.answered) * 100)}%` }}
                            transition={{ delay: Math.min(i, 10) * 0.04 }}
                          />
                        </div>
                        <div className="mt-0.5 text-xs text-ordo-ink/45">{t.answers(tp.answered)}</div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="card min-w-0 p-5 2xl:col-span-3">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-lg font-bold">{t.studentsTitle}</h2>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ['all', t.filterAll, s.members],
                      ['attention', t.filterAttention, attention],
                      ['active', t.filterActive, s.active],
                    ] as const
                  ).map(([key, label, n]) => (
                    <button
                      key={key}
                      onClick={() => setFilter(key)}
                      className={`rounded-full px-3 py-1 text-sm font-semibold transition ${filter === key ? 'bg-ordo-night text-ordo-gold' : 'bg-ordo-ink/5 text-ordo-ink/70 hover:bg-ordo-ink/10'}`}
                    >
                      {label} <span className="tabular-nums opacity-60">{n}</span>
                    </button>
                  ))}
                </div>
              </div>
              {rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-ordo-ink/55">{t.emptyFilter}</p>
              ) : (
                <div className="-mx-5 overflow-x-auto px-5">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-ordo-ink/10 text-left text-xs uppercase tracking-wide text-ordo-ink/45">
                        <th className="py-2 pr-3 font-semibold">{t.colName}</th>
                        <th className="py-2 pr-3 font-semibold">{t.colStatus}</th>
                        <th className="py-2 pr-3 font-semibold">{t.colWeek}</th>
                        <th className="py-2 pr-3 text-right font-semibold">{t.colStreak}</th>
                        <th className="py-2 pr-3 text-right font-semibold">{t.colAccuracy}</th>
                        <th className="py-2 pr-3 font-semibold">{t.colWeak}</th>
                        <th className="py-2 font-semibold">{t.colLast}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <StudentRow key={r.id} r={r} days={data.days} showClass={!cls} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Tile({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: ReactNode; hint?: string; tone?: 'warn' }) {
  return (
    <div className="card p-4">
      <div className={`flex items-center gap-1.5 text-sm font-semibold [&_svg]:h-4 [&_svg]:w-4 ${tone ? 'text-rose-700' : 'text-ordo-ink/55'}`}>
        {icon} {label}
      </div>
      <div className="mt-1 font-display text-3xl font-black tabular-nums">{value}</div>
      {hint && <div className="text-xs text-ordo-ink/45">{hint}</div>}
    </div>
  );
}

function StudentRow({ r, days, showClass }: { r: Row; days: string[]; showClass: boolean }) {
  const t = ky.admin.analytics;
  const st = STATUS_STYLE[r.status];
  const Icon = st.icon;
  const last = r.daysAgo === null ? t.noData : r.daysAgo === 0 ? t.today : r.daysAgo === 1 ? t.yesterday : t.daysAgo(r.daysAgo);
  return (
    <tr className="border-b border-ordo-ink/5 last:border-0">
      <td className="py-2.5 pr-3">
        <Link to={`/admin/rating/student/${r.id}`} className="font-semibold hover:text-ordo-red">
          {r.name}
        </Link>
        {showClass && r.className && <div className="text-xs text-ordo-ink/45">{r.className}</div>}
      </td>
      <td className="py-2.5 pr-3">
        <span title={r.status === 'NO_CODE' ? t.noCodeTip : undefined} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${st.cls}`}>
          <Icon className="h-3.5 w-3.5" /> {t.status[r.status]}
        </span>
      </td>
      <td className="py-2.5 pr-3">
        <div className="flex gap-1">
          {r.week.map((done, i) => (
            <span
              key={days[i]}
              title={days[i]}
              className={`flex h-4 w-4 items-center justify-center rounded ${done ? 'bg-ordo-gold text-ordo-night' : 'bg-ordo-ink/[0.07]'}`}
            >
              {done && <CircleCheck className="h-3 w-3" />}
            </span>
          ))}
        </div>
      </td>
      <td className="py-2.5 pr-3 text-right tabular-nums">
        {r.streak > 0 ? (
          <span className="font-semibold text-orange-600">
            <Flame className="ico" /> {r.streak}
          </span>
        ) : (
          <span className="text-ordo-ink/30">0</span>
        )}
      </td>
      <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{r.accuracy === null ? <span className="text-ordo-ink/30">{t.noData}</span> : `${r.accuracy}%`}</td>
      <td className="py-2.5 pr-3">
        {r.weakTopic ? (
          <span className="whitespace-nowrap text-rose-700">
            {r.weakTopic.category} <span className="text-xs opacity-70">{r.weakTopic.accuracy}%</span>
          </span>
        ) : (
          <span className="text-ordo-ink/30">{t.noData}</span>
        )}
      </td>
      <td className="whitespace-nowrap py-2.5 text-ordo-ink/60">{last}</td>
    </tr>
  );
}
