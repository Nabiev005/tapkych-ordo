import { Bird, BookOpen, Bug, Cat, Crown, Dog, Fish, Flower2, Gem, Moon, Mountain, Music, Rabbit, Rocket, Squirrel, Star, Sun, Trophy, Turtle, Zap, type LucideIcon } from 'lucide-react';

/** Оюнчунун аватары: ачкычтар сервердеги AVATARS тизмеси менен бирдей (server/src/types.ts) */
export const AVATARS: Record<string, { icon: LucideIcon; color: string }> = {
  cat: { icon: Cat, color: '#f97316' },
  dog: { icon: Dog, color: '#a16207' },
  bird: { icon: Bird, color: '#0ea5e9' },
  fish: { icon: Fish, color: '#06b6d4' },
  rabbit: { icon: Rabbit, color: '#ec4899' },
  squirrel: { icon: Squirrel, color: '#c2410c' },
  turtle: { icon: Turtle, color: '#16a34a' },
  bug: { icon: Bug, color: '#dc2626' },
  rocket: { icon: Rocket, color: '#7c3aed' },
  star: { icon: Star, color: '#eab308' },
  crown: { icon: Crown, color: '#d97706' },
  mountain: { icon: Mountain, color: '#0f766e' },
  sun: { icon: Sun, color: '#f59e0b' },
  moon: { icon: Moon, color: '#4f46e5' },
  flower: { icon: Flower2, color: '#db2777' },
  gem: { icon: Gem, color: '#2563eb' },
  zap: { icon: Zap, color: '#ca8a04' },
  book: { icon: BookOpen, color: '#9333ea' },
  music: { icon: Music, color: '#e11d48' },
  trophy: { icon: Trophy, color: '#b45309' },
};

/** Тегерек аватар. Тандалбаса — аттын биринчи тамгасы */
export function Avatar({ id, name, size = 32, className = '' }: { id?: string | null; name?: string; size?: number; className?: string }) {
  const a = id ? AVATARS[id] : undefined;
  const style = { width: size, height: size, background: a?.color ?? 'rgba(255,255,255,0.18)' };
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full text-white shadow ring-2 ring-white/40 ${className}`} style={style}>
      {a ? <a.icon style={{ width: size * 0.6, height: size * 0.6 }} /> : <span className="font-display font-black" style={{ fontSize: size * 0.45 }}>{(name ?? '?').trim().charAt(0).toUpperCase()}</span>}
    </span>
  );
}

/** Аватар тандоо торчосу (оюнчунун телефонунда, лоббиде) */
export function AvatarPicker({ value, onPick }: { value: string; onPick: (id: string) => void }) {
  return (
    <div className="grid grid-cols-5 gap-2.5">
      {Object.entries(AVATARS).map(([id, a]) => (
        <button
          key={id}
          type="button"
          aria-label={id}
          aria-pressed={value === id}
          onClick={() => onPick(id)}
          className={`flex aspect-square items-center justify-center rounded-2xl text-white transition active:scale-90 ${value === id ? 'ring-4 ring-ordo-gold scale-105' : 'opacity-80 ring-1 ring-white/20'}`}
          style={{ background: a.color }}
        >
          <a.icon className="h-7 w-7" />
        </button>
      ))}
    </div>
  );
}
