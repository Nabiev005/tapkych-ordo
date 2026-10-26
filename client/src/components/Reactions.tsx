import { AnimatePresence, motion } from 'framer-motion';
import { Flame, Heart, Laugh, PartyPopper, Sparkles, ThumbsUp, type LucideIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { vibrate } from '../lib/sound';

/** Залдын реакциялары: ачкычтар сервердеги REACTIONS тизмеси менен бирдей */
export const REACTIONS: Record<string, { icon: LucideIcon; color: string }> = {
  clap: { icon: ThumbsUp, color: '#1ba4e3' },
  fire: { icon: Flame, color: '#f97316' },
  heart: { icon: Heart, color: '#e11d48' },
  wow: { icon: Sparkles, color: '#f5b700' },
  laugh: { icon: Laugh, color: '#22c55e' },
  party: { icon: PartyPopper, color: '#a855f7' },
};

const COOLDOWN_MS = 700;

/** Телефондогу реакция баскычтары (көрүүчү жана оюнчу) */
export function ReactionBar({ onSend, label }: { onSend: (kind: string) => void; label?: string }) {
  const last = useRef(0);
  const [pressed, setPressed] = useState<string | null>(null);
  const send = (kind: string) => {
    const now = Date.now();
    if (now - last.current < COOLDOWN_MS) return;
    last.current = now;
    onSend(kind);
    vibrate(15);
    setPressed(kind);
    setTimeout(() => setPressed(null), 250);
  };
  return (
    <div className="w-full">
      {label && <div className="mb-1.5 text-center text-xs text-white/50">{label}</div>}
      <div className="flex justify-center gap-2">
        {Object.entries(REACTIONS).map(([kind, r]) => (
          <motion.button
            key={kind}
            type="button"
            aria-label={kind}
            whileTap={{ scale: 0.8 }}
            animate={pressed === kind ? { scale: [1, 1.3, 1] } : undefined}
            onClick={() => send(kind)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15"
          >
            <r.icon className="h-6 w-6" style={{ color: r.color }} />
          </motion.button>
        ))}
      </div>
    </div>
  );
}

interface Flying {
  id: number;
  kind: string;
  x: number;
}

const MAX_ON_SCREEN = 30;

/** Экранда учуп чыккан реакциялар. push(kind) — жаңы реакция кошот */
export function useFlyingReactions() {
  const [items, setItems] = useState<Flying[]>([]);
  const seq = useRef(0);
  const push = (kind: string) => {
    if (!REACTIONS[kind]) return;
    const id = ++seq.current;
    setItems((list) => [...list.slice(-(MAX_ON_SCREEN - 1)), { id, kind, x: 4 + Math.random() * 18 }]);
    setTimeout(() => setItems((list) => list.filter((f) => f.id !== id)), 3200);
  };
  return { items, push };
}

export function FlyingReactions({ items }: { items: Flying[] }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-30 w-[28vw] overflow-hidden">
      <AnimatePresence>
        {items.map((f) => {
          const r = REACTIONS[f.kind];
          return (
            <motion.div
              key={f.id}
              initial={{ y: 0, opacity: 0, scale: 0.6 }}
              animate={{ y: '-78vh', opacity: [0, 1, 1, 0], scale: 1.2, x: [0, 18, -14, 8] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 3, ease: 'easeOut' }}
              className="absolute bottom-[4vh]"
              style={{ right: `${f.x}vw` }}
            >
              <r.icon className="h-[clamp(2.5rem,4vw,4.5rem)] w-[clamp(2.5rem,4vw,4.5rem)] drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]" style={{ color: r.color }} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
