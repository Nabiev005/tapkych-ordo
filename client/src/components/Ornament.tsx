import { motion } from 'framer-motion';
import { useId } from 'react';
import { ky } from '../i18n/ky';

/** «Кочкор мүйүз» — кыргыз оюусунун негизги элементи */
const HORN =
  'M60 58V36C60 18 44 8 30 12C16 16 14 34 26 38C36 41 40 30 33 26C29 24 25 27 27 31' +
  'M60 36C60 18 76 8 90 12C104 16 106 34 94 38C84 41 80 30 87 26C91 24 95 27 93 31' +
  'M60 58C51 58 47 50 52 46M60 58C69 58 73 50 68 46';

export function HornMotif({ className = '', color = 'currentColor', width = 4 }: { className?: string; color?: string; width?: number }) {
  return (
    <svg viewBox="0 0 120 62" className={className} fill="none" aria-hidden>
      <path d={HORN} stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Кайталанма оюу тилкеси (баракчанын үстү/асты үчүн) */
export function OrnamentBand({ className = '', color = '#f5b700', bg = 'transparent', height = 28, flip = false }: {
  className?: string;
  color?: string;
  bg?: string;
  height?: number;
  flip?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={className} width="100%" height={height} aria-hidden style={{ display: 'block', transform: flip ? 'scaleY(-1)' : undefined }}>
      <defs>
        <pattern id={`p${id}`} width={height * 2.2} height={height} patternUnits="userSpaceOnUse">
          <rect width="100%" height="100%" fill={bg} />
          <g transform={`scale(${height / 70}) translate(8 4)`}>
            <path d={HORN} stroke={color} strokeWidth={5} fill="none" strokeLinecap="round" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height={height} fill={`url(#p${id})`} />
      <rect width="100%" height={2} fill={color} opacity={0.6} />
      <rect y={height - 2} width="100%" height={2} fill={color} opacity={0.6} />
    </svg>
  );
}

/** Бурчтагы оюу (карточкалар жана экран үчүн) */
export function CornerOrnament({ className = '', color = '#f5b700' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden>
      <path
        d="M4 96V40C4 20 20 4 40 4h56M14 96V44c0-16 14-30 30-30h52"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".7"
      />
      <path d="M30 60c0-18 12-30 30-30 12 0 18 10 12 18-5 6-14 3-13-4" stroke={color} strokeWidth="4" strokeLinecap="round" />
      <path d="M30 60c-10 0-14 10-8 15 4 3 9 0 8-5" stroke={color} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** 40 нурлуу күн жана түндүк (Кыргызстандын туусундагыдай) */
export function SunTunduk({ size = 120, spin = true, className = '' }: { size?: number; spin?: boolean; className?: string }) {
  const rays = Array.from({ length: 40 }, (_, i) => {
    const a = (i * 360) / 40;
    return <polygon key={i} points="50,2 52.2,22 47.8,22" transform={`rotate(${a} 50 50)`} />;
  });
  return (
    <div className={className} style={{ width: size, height: size, position: 'relative' }}>
      <motion.svg
        viewBox="0 0 100 100"
        className="absolute inset-0"
        animate={spin ? { rotate: 360 } : undefined}
        transition={{ duration: 80, ease: 'linear', repeat: Infinity }}
        aria-hidden
      >
        <g fill="#f5b700">{rays}</g>
      </motion.svg>
      <svg viewBox="0 0 100 100" className="absolute inset-0" aria-hidden>
        <circle cx="50" cy="50" r="26" fill="#f5b700" />
        <g fill="none" stroke="#c8102e" strokeWidth="2.6">
          <circle cx="50" cy="50" r="21" />
          <path d="M31 42q19 8 38 0M29 50h42M31 58q19-8 38 0" />
          <path d="M42 31q8 19 0 38M50 29v42M58 31q-8 19 0 38" />
        </g>
      </svg>
    </div>
  );
}

export function Logo({ size = 'md', onDark = true }: { size?: 'sm' | 'md' | 'lg' | 'xl'; onDark?: boolean }) {
  const s = { sm: [36, 'text-lg'], md: [56, 'text-2xl'], lg: [110, 'text-5xl'], xl: [190, 'text-7xl md:text-8xl'] }[size] as [number, string];
  const vertical = size === 'lg' || size === 'xl';
  return (
    <div className={`flex items-center ${vertical ? 'flex-col gap-4' : 'gap-3'}`}>
      <SunTunduk size={s[0]} spin={vertical} />
      <div className={vertical ? 'text-center' : ''}>
        <div
          className={`font-display font-black tracking-wide leading-none ${s[1]} ${onDark ? 'text-gold-gradient drop-shadow-[0_4px_20px_rgba(245,183,0,0.35)]' : 'text-ordo-red'}`}
        >
          {ky.appNameUpper}
        </div>
        {vertical && (
          <div className={`mt-2 font-display text-sm tracking-[0.4em] uppercase md:text-base ${onDark ? 'text-ordo-sky-light/80' : 'text-ordo-ink/60'}`}>
            {ky.tagline}
          </div>
        )}
      </div>
    </div>
  );
}
