import { motion } from 'framer-motion';
import { Crown, School, Star } from 'lucide-react';
import { ky } from '../i18n/ky';
import type { LeagueView } from '../lib/types';
import { RankMedal } from './game';

/**
 * Лиганын таблицасы жана мыкты оюнчулар.
 * dark — ачык бет (караңгы фон), болбосо админ панели (ачык фон).
 */
export function LeagueStandings({ league, dark = false }: { league: LeagueView; dark?: boolean }) {
  const t = ky.league;
  const muted = dark ? 'text-white/55' : 'text-ordo-ink/55';
  const row = dark ? 'bg-white/[0.06] ring-1 ring-white/10' : 'bg-white ring-1 ring-ordo-gold/20';
  const played = league.standings.some((s) => s.rounds > 0);
  const max = Math.max(1, ...league.standings.map((s) => s.points));

  return (
    <div className="space-y-2">
      <div
        className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-3 text-xs font-semibold uppercase tracking-wide sm:grid-cols-[2.5rem_1fr_4rem_4rem_4.5rem] ${muted}`}
      >
        <span className="text-center">{t.place}</span>
        <span>{t.school}</span>
        <span className="hidden text-right sm:block">{t.roundsCol}</span>
        <span className="hidden text-right sm:block" title={t.scoreHint}>
          {t.score}
        </span>
        <span className="text-right">{t.points}</span>
      </div>
      {league.standings.map((s, i) => (
        <motion.div
          key={s.school}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i, 12) * 0.04 }}
          className={`relative grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 overflow-hidden rounded-2xl p-3 sm:grid-cols-[2.5rem_1fr_4rem_4rem_4.5rem] ${row} ${played && s.place === 1 ? 'ring-2 ring-ordo-gold' : ''}`}
        >
          {/* Упайдын үлүшү — фондогу тилке */}
          {played && <div className="absolute inset-y-0 left-0 bg-ordo-gold/10" style={{ width: `${(s.points / max) * 100}%` }} />}
          <span className={`relative text-center font-display text-xl font-black ${muted}`}>
            {played && s.place <= 3 && s.points > 0 ? <RankMedal rank={s.place} className="ico" /> : s.place}
          </span>
          <span className="relative min-w-0">
            <span className="block truncate font-display text-lg font-bold">
              <School className={`ico ${muted}`} /> {s.school}
            </span>
            <span className={`block text-xs ${muted}`}>{t.participants(s.participants)}</span>
          </span>
          <span className={`relative hidden text-right tabular-nums sm:block ${muted}`}>{s.rounds}</span>
          <span className={`relative hidden text-right tabular-nums sm:block ${muted}`}>{s.score}</span>
          <span className="relative text-right font-display text-2xl font-black tabular-nums">{s.points}</span>
        </motion.div>
      ))}
      {!played && <p className={`pt-2 text-sm ${muted}`}>{t.noResults}</p>}
      <p className={`pt-2 text-xs ${muted}`}>
        {t.topNRule(league.topN)} {t.pointsRule}
      </p>
    </div>
  );
}

export function LeagueTopPlayers({ league, dark = false }: { league: LeagueView; dark?: boolean }) {
  const muted = dark ? 'text-white/55' : 'text-ordo-ink/55';
  if (!league.topPlayers.length) return null;
  return (
    <ol className="space-y-1.5">
      {league.topPlayers.map((p, i) => (
        <li key={`${p.school}-${p.name}`} className="flex items-center gap-3">
          <span className={`w-6 text-center font-display font-black ${muted}`}>{i < 3 ? <RankMedal rank={i + 1} className="ico" /> : i + 1}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{p.name}</span>
            <span className={`block truncate text-xs ${muted}`}>{p.school}</span>
          </span>
          <span className="font-display font-black tabular-nums">
            <Star className="ico text-ordo-gold" /> {p.score}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Турдун жеңүүчү мектеби (катышуучу болсо) */
export function RoundWinner({ round, dark = false }: { round: LeagueView['rounds'][number]; dark?: boolean }) {
  const w = round.schools.find((s) => s.place === 1);
  if (!w) return null;
  return (
    <span className={`text-sm ${dark ? 'text-ordo-gold-light' : 'text-amber-700'}`}>
      <Crown className="ico" /> {ky.league.roundWinner}: <b>{w.school}</b> · {w.score}
    </span>
  );
}
