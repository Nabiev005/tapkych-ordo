import { motion } from 'framer-motion';
import { Flame, Users } from 'lucide-react';
import { ky } from '../i18n/ky';
import type { PracticeLeaderboard } from '../lib/types';
import { RankMedal } from './game';

/**
 * Топтордун жумалык машыгуу рейтинги жана серия чемпиондору.
 * dark — студенттин кабинети (караңгы фон), болбосо админ панели (ачык фон).
 */
export function PracticeBoard({ data, dark = false, maxGroups }: { data: PracticeLeaderboard; dark?: boolean; maxGroups?: number }) {
  const t = ky.practiceBoard;
  const groups = maxGroups ? data.groups.slice(0, maxGroups) : [...data.groups];
  // Студенттин өз тобу тизмеде көрүнбөсө — аягына кошобуз
  const mine = data.myGroup ? data.groups.find((g) => g.className === data.myGroup) : undefined;
  if (mine && !groups.includes(mine)) groups.push(mine);
  const nobody = data.groups.every((g) => g.completions === 0) && data.streaks.length === 0;

  const card = dark ? 'bg-white/[0.07] ring-1 ring-white/10' : 'bg-white ring-1 ring-ordo-gold/20';
  const muted = dark ? 'text-white/55' : 'text-ordo-ink/55';
  const bar = dark ? 'bg-white/10' : 'bg-ordo-ink/5';

  if (!data.groups.length && !data.streaks.length) return <p className={muted}>{t.noGroups}</p>;
  if (nobody) return <p className={muted}>{t.empty}</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="space-y-2 lg:col-span-3">
        {groups.map((g, i) => {
          const me = g.className === data.myGroup;
          return (
            <motion.div
              key={g.className}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i, 10) * 0.05 }}
              className={`flex items-center gap-3 rounded-2xl p-3 ${card} ${me ? 'ring-2 ring-ordo-gold' : ''}`}
            >
              <div className={`w-8 shrink-0 text-center font-display text-xl font-black ${muted}`}>
                {g.place <= 3 && g.activity > 0 ? <RankMedal rank={g.place} className="ico" /> : g.place}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-display text-lg font-bold">
                    {g.className}
                    {me && <span className="ml-2 rounded-md bg-ordo-gold px-1.5 py-0.5 align-middle text-xs font-bold text-ordo-night">{t.myGroup}</span>}
                  </span>
                  <span className="font-display text-lg font-black tabular-nums" title={t.activityHint}>
                    {g.activity}%
                  </span>
                </div>
                <div className={`mt-1.5 h-2 overflow-hidden rounded-full ${bar}`}>
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-ordo-gold" initial={{ width: 0 }} animate={{ width: `${g.activity}%` }} />
                </div>
                <div className={`mt-1 flex flex-wrap gap-x-3 text-xs ${muted}`}>
                  <span>
                    <Users className="ico" /> {t.active(g.active, g.members)}
                  </span>
                  {g.completions > 0 && <span>{t.accuracy(g.accuracy)}</span>}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className={`rounded-2xl p-4 lg:col-span-2 ${card}`}>
        <div className="mb-2 font-display font-bold">
          <Flame className="ico text-orange-400" /> {t.streaksTitle}
        </div>
        {data.streaks.length === 0 && <p className={`text-sm ${muted}`}>—</p>}
        <ol className="space-y-1.5">
          {data.streaks.map((s, i) => (
            <li key={s.studentId} className={`flex items-center gap-2 rounded-xl px-2 py-1 ${s.studentId === data.myId ? 'bg-ordo-gold/20' : ''}`}>
              <span className={`w-5 text-right text-sm font-bold ${muted}`}>{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">
                {s.name} {s.className && <span className={`text-xs font-normal ${muted}`}>· {s.className}</span>}
              </span>
              <span className="shrink-0 font-display font-black text-orange-400">
                <Flame className="ico" fill="currentColor" /> {t.days(s.streak)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
