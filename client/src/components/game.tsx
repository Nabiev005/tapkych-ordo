import { AnimatePresence, motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { ky, type OptionKey } from '../i18n/ky';
import type { Ranked, TeamStanding } from '../lib/types';
import { CornerOrnament } from './Ornament';

export const OPTION_STYLE: Record<OptionKey, { bg: string; ring: string; glow: string; hex: string }> = {
  A: { bg: 'bg-opt-a', ring: 'ring-opt-a', glow: 'shadow-[0_0_40px_rgba(225,29,72,0.6)]', hex: '#e11d48' },
  B: { bg: 'bg-opt-b', ring: 'ring-opt-b', glow: 'shadow-[0_0_40px_rgba(14,165,233,0.6)]', hex: '#0ea5e9' },
  C: { bg: 'bg-opt-c', ring: 'ring-opt-c', glow: 'shadow-[0_0_40px_rgba(245,158,11,0.6)]', hex: '#f59e0b' },
  D: { bg: 'bg-opt-d', ring: 'ring-opt-d', glow: 'shadow-[0_0_40px_rgba(16,185,129,0.6)]', hex: '#10b981' },
};

/** Тегерек таймер. msLeft — сервер боюнча калган убакыт */
export function RingTimer({ msLeft, totalSec, size = 160, paused }: { msLeft: number; totalSec: number; size?: number; paused?: boolean }) {
  const sec = Math.ceil(msLeft / 1000);
  const frac = Math.max(0, Math.min(1, msLeft / (totalSec * 1000)));
  const r = 44;
  const c = 2 * Math.PI * r;
  const urgent = sec <= 5 && msLeft > 0;
  const color = msLeft === 0 ? '#64748b' : urgent ? '#e11d48' : frac < 0.5 ? '#f5b700' : '#1ba4e3';
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="rgba(7,18,38,0.6)" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 0.1s linear, stroke 0.3s' }}
        />
      </svg>
      <motion.div
        key={sec}
        initial={urgent ? { scale: 1.35 } : false}
        animate={{ scale: 1 }}
        className="absolute inset-0 flex items-center justify-center font-display font-black text-white tabular-nums"
        style={{ fontSize: size * 0.38, color: urgent ? '#ff6b86' : 'white' }}
      >
        {paused ? '⏸' : sec}
      </motion.div>
    </div>
  );
}

/** Жалпы экрандагы вариант карточкасы */
export function OptionCard({
  letter,
  text,
  correct,
  dim,
  count,
  index = 0,
  tf,
}: {
  letter: OptionKey;
  text: string;
  correct?: boolean;
  dim?: boolean;
  count?: number | null;
  index?: number;
  /** «Туура / Туура эмес»: А — жашыл ✓, Б — кызыл ✗ (телефондогудай) */
  tf?: boolean;
}) {
  const st = OPTION_STYLE[tf ? (letter === 'A' ? 'D' : 'A') : letter];
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: dim ? 0.3 : 1, y: 0, scale: correct ? 1.03 : 1 }}
      transition={{ delay: index * 0.08, type: 'spring', damping: 18 }}
      className={`relative flex items-center gap-5 overflow-hidden rounded-3xl border-2 p-4 pr-6 md:p-5 ${
        correct ? `border-white bg-white/15 ${st.glow}` : 'border-white/15 bg-white/[0.07]'
      }`}
    >
      <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl font-display text-4xl font-black text-white md:h-20 md:w-20 md:text-5xl ${st.bg}`}>
        {tf ? (letter === 'A' ? '✓' : '✗') : ky.options[letter]}
      </div>
      <div className="flex-1 text-2xl font-semibold leading-tight text-white md:text-4xl">{text}</div>
      {correct && (
        <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} className="text-5xl md:text-6xl">
          ✅
        </motion.div>
      )}
      {count !== undefined && count !== null && (
        <div className="rounded-xl bg-black/30 px-3 py-1 font-display text-2xl font-bold text-white/90 tabular-nums">{count}</div>
      )}
    </motion.div>
  );
}

/** Анимациялуу рейтинг таблицасы */
export function LeaderboardList({ rows, highlight = [], big, compact, light, maxRows }: { rows: Ranked[]; highlight?: number[]; big?: boolean; compact?: boolean; light?: boolean; maxRows?: number }) {
  const list = maxRows ? rows.slice(0, maxRows) : rows;
  const medal = (rank: number, score: number) => (score <= 0 ? null : rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null);
  return (
    <div className={`flex flex-col ${big && !compact ? 'gap-2.5' : 'gap-1.5'}`}>
      <AnimatePresence>
        {list.map((r, i) => {
          const hi = highlight.includes(r.playerId);
          return (
            <motion.div
              key={r.playerId}
              layout
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ layout: { type: 'spring', damping: 22, stiffness: 200 }, delay: i * 0.05 }}
              className={`flex items-center gap-4 rounded-2xl ${big ? (compact ? 'px-6 py-2' : 'px-6 py-3.5') : 'px-4 py-2'} ${
                light
                  ? hi
                    ? 'bg-emerald-50 ring-2 ring-emerald-400'
                    : 'bg-white ring-1 ring-ordo-gold/20'
                  : hi
                    ? 'bg-gradient-to-r from-ordo-gold/30 to-ordo-gold/5 ring-2 ring-ordo-gold'
                    : 'bg-white/[0.07] ring-1 ring-white/10'
              }`}
            >
              <div className={`w-12 text-center font-display font-black tabular-nums ${big ? 'text-3xl' : 'text-xl'} ${light ? 'text-ordo-ink/60' : 'text-ordo-gold'}`}>
                {medal(r.rank, r.score) ?? r.rank}
              </div>
              <div className={`flex-1 truncate font-semibold ${big ? 'text-3xl' : 'text-lg'} ${light ? 'text-ordo-ink' : 'text-white'}`}>
                {r.name}
                {r.tied && <span className="ml-2 rounded-md bg-ordo-red px-2 py-0.5 align-middle text-xs font-bold text-white">{ky.admin.control.tie}</span>}
              </div>
              <div className={`tabular-nums ${big ? 'text-xl' : 'text-sm'} ${light ? 'text-ordo-ink/50' : 'text-white/50'}`}>{ky.common.sec(r.timeMs)}</div>
              <div className={`min-w-16 text-right font-display font-black tabular-nums ${big ? 'text-4xl' : 'text-2xl'} ${light ? 'text-ordo-red' : 'text-white'}`}>{r.score}</div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/** Жеңүүчүлөр пьедесталы */
export function Podium({ top }: { top: { name: string; score: number; total?: number }[] }) {
  const order = [1, 0, 2]; // 2-орун сол жакта, 1-орун ортодо, 3-орун оң жакта
  const heights = ['h-72 md:h-80', 'h-52 md:h-60', 'h-40 md:h-44'];
  const colors = [
    'from-ordo-gold-light via-ordo-gold to-ordo-gold-dark',
    'from-slate-100 via-slate-300 to-slate-500',
    'from-orange-200 via-orange-400 to-orange-700',
  ];
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div className="flex items-end justify-center gap-4 md:gap-8">
      {order.map((idx, col) => {
        const p = top[idx];
        if (!p) return <div key={col} className="w-48 md:w-64" />;
        return (
          <motion.div
            key={idx}
            className="flex w-48 flex-col items-center md:w-64"
            initial={{ opacity: 0, y: 120 }}
            animate={{ opacity: 1, y: 0 }}
            // Адегенде 3-орун, анан 2-орун, акырында жеңүүчү чыгат
            transition={{ delay: [1.0, 1.8, 0.3][col], type: 'spring', damping: 14 }}
          >
            <motion.div
              className="mb-3 text-6xl md:text-7xl"
              animate={idx === 0 ? { y: [0, -10, 0] } : undefined}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              {idx === 0 ? '👑' : medals[idx]}
            </motion.div>
            <div className={`mb-2 text-center font-display font-black leading-tight text-white ${idx === 0 ? 'text-3xl md:text-4xl' : 'text-2xl md:text-3xl'}`}>
              {p.name}
            </div>
            <div className="mb-3 font-display text-xl text-ordo-gold-light md:text-2xl">
              {p.score} {ky.screen.score}
            </div>
            <div className={`relative w-full overflow-hidden rounded-t-3xl bg-gradient-to-b ${colors[idx]} ${heights[idx]} shadow-2xl`}>
              <CornerOrnament className="absolute left-2 top-2 h-12 w-12 opacity-60" color="#ffffff" />
              <CornerOrnament className="absolute right-2 top-2 h-12 w-12 -scale-x-100 opacity-60" color="#ffffff" />
              <div className="absolute inset-x-0 top-6 text-center font-display text-7xl font-black text-white/90 drop-shadow md:text-8xl">{idx + 1}</div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export function JoinQr({ url, size = 220 }: { url: string; size?: number }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-2xl ring-4 ring-ordo-gold">
      <QRCodeSVG value={url} size={size} level="M" fgColor="#0b1d3a" />
    </div>
  );
}

/** Командалык рейтинг (топ топко каршы) */
export function TeamBoard({ teams, light, big }: { teams: TeamStanding[]; light?: boolean; big?: boolean }) {
  const medal = ['🥇', '🥈', '🥉'];
  const max = Math.max(1, ...teams.map((t) => t.total));
  return (
    <div className={`flex flex-col ${big ? 'gap-3' : 'gap-1.5'}`}>
      {teams.map((t, i) => (
        <motion.div
          key={t.team}
          layout
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
          className={`relative overflow-hidden rounded-2xl ${big ? 'px-6 py-4' : 'px-4 py-2'} ${light ? 'bg-white ring-1 ring-ordo-gold/20' : 'bg-white/[0.07] ring-1 ring-white/10'}`}
        >
          <div
            className={`absolute inset-y-0 left-0 ${light ? 'bg-ordo-gold/15' : 'bg-gradient-to-r from-ordo-gold/30 to-ordo-gold/5'}`}
            style={{ width: `${(t.total / max) * 100}%` }}
          />
          <div className="relative flex items-center gap-4">
            <div className={`w-10 text-center font-display font-black ${big ? 'text-4xl' : 'text-xl'} ${light ? 'text-ordo-ink/60' : 'text-ordo-gold'}`}>{medal[i] ?? t.place}</div>
            <div className={`flex-1 font-display font-black ${big ? 'text-4xl' : 'text-lg'} ${light ? 'text-ordo-ink' : 'text-white'}`}>{t.team}</div>
            <div className={`${big ? 'text-xl' : 'text-xs'} ${light ? 'text-ordo-ink/50' : 'text-white/60'}`}>
              {ky.screen.members(t.members)} · {ky.admin.control.average} {t.average}
            </div>
            <div className={`min-w-14 text-right font-display font-black tabular-nums ${big ? 'text-5xl' : 'text-2xl'} ${light ? 'text-ordo-red' : 'text-white'}`}>{t.total}</div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/** Залдын добуштары: ар бир вариант канча пайыз */
export function AudienceBars({ counts, total, keys, correct }: { counts: Record<OptionKey, number>; total: number; keys: OptionKey[]; correct?: string | null }) {
  return (
    <div className="flex items-end gap-3">
      {keys.map((k) => {
        const pct = total ? Math.round((counts[k] / total) * 100) : 0;
        return (
          <div key={k} className="flex w-16 flex-col items-center gap-1">
            <div className="font-display text-lg font-black tabular-nums text-white">{pct}%</div>
            <div className="flex h-24 w-10 items-end overflow-hidden rounded-lg bg-white/10">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${pct}%` }}
                transition={{ type: 'spring', damping: 18 }}
                className={`w-full ${OPTION_STYLE[k].bg} ${correct === k ? 'ring-2 ring-white' : ''}`}
              />
            </div>
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg font-display font-black text-white ${OPTION_STYLE[k].bg}`}>{ky.options[k]}</div>
          </div>
        );
      })}
    </div>
  );
}
