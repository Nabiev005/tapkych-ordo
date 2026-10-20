import { motion } from 'framer-motion';
import { useId } from 'react';
import { ky } from '../i18n/ky';
import { SUN_CX, SUN_CY, SUN_DISC_R, SUN_PATH, SUN_R } from './flagSun';

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

/**
 * Кыргызстандын туусундагы күн жана түндүк — расмий тууданын формасы (flagSun.ts):
 * 40 түз нур, диск жана кесилишкен жаалардан турган түндүк. spin — нурлар акырын айланат, түндүк кыймылсыз.
 */
export function SunTunduk({ size = 120, spin = true, className = '' }: { size?: number; spin?: boolean; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const view = `${SUN_CX - SUN_R} ${SUN_CY - SUN_R} ${SUN_R * 2} ${SUN_R * 2}`;
  return (
    <div className={className} style={{ width: size, height: size, position: 'relative' }}>
      {/* Нурлар: дисктен тышкары бөлүгү гана (айланат) */}
      <motion.svg
        viewBox={view}
        className="absolute inset-0"
        animate={spin ? { rotate: 360 } : undefined}
        transition={{ duration: 80, ease: 'linear', repeat: Infinity }}
        aria-hidden
      >
        <defs>
          <mask id={`rays-${uid}`}>
            <rect x={SUN_CX - SUN_R} y={SUN_CY - SUN_R} width={SUN_R * 2} height={SUN_R * 2} fill="#fff" />
            <circle cx={SUN_CX} cy={SUN_CY} r={SUN_DISC_R} fill="#000" />
          </mask>
        </defs>
        <path d={SUN_PATH} fill="#f5b700" fillRule="evenodd" mask={`url(#rays-${uid})`} />
      </motion.svg>
      {/* Диск жана түндүк: кызыл фон түндүктүн сызыктарын туудагыдай кызыл кылат */}
      <svg viewBox={view} className="absolute inset-0" aria-hidden>
        <defs>
          <clipPath id={`disc-${uid}`}>
            <circle cx={SUN_CX} cy={SUN_CY} r={SUN_DISC_R} />
          </clipPath>
        </defs>
        <circle cx={SUN_CX} cy={SUN_CY} r={SUN_DISC_R - 0.4} fill="#c8102e" />
        <path d={SUN_PATH} fill="#f5b700" fillRule="evenodd" clipPath={`url(#disc-${uid})`} />
      </svg>
    </div>
  );
}

/** Бренддин SVG файлдары: client/public/brand/ */
export const BRAND = {
  icon: '/brand/tapkych-icon.svg',
  mascot: '/brand/tapkych-mascot.svg',
  logoDark: '/brand/tapkych-logo-dark.svg',
  logoLight: '/brand/tapkych-logo-light.svg',
  headerLight: '/brand/tapkych-header-light.svg',
};

/**
 * Логотип. sm — тилкелер жана меню үчүн (иконка + аталыш), калгандары — маскот менен толук логотип.
 * onDark — караңгы фон (демейки), false — ачык фон.
 */
export function Logo({ size = 'md', onDark = true }: { size?: 'sm' | 'md' | 'lg' | 'xl'; onDark?: boolean }) {
  if (size === 'sm') {
    if (!onDark) return <img src={BRAND.headerLight} alt={ky.appName} className="h-10 w-auto" />;
    return (
      <div className="flex items-center gap-2.5">
        <img src={BRAND.icon} alt="" className="h-10 w-10" />
        <div className="font-display leading-none">
          <div className="text-xl font-black lowercase tracking-wide text-ordo-gold">{ky.appNameUpper.split(' ')[0]}</div>
          <div className="mt-0.5 text-sm font-bold tracking-[0.3em] text-white/85">{ky.appNameUpper.split(' ').slice(1).join(' ')}</div>
        </div>
      </div>
    );
  }
  const h = { md: 'h-16', lg: 'h-28', xl: 'h-[clamp(9rem,22vh,15rem)]' }[size];
  return <img src={onDark ? BRAND.logoDark : BRAND.logoLight} alt={ky.appName} className={`${h} w-auto drop-shadow-[0_6px_24px_rgba(0,0,0,0.25)]`} />;
}

/** «Тапкыч» маскоту — бүркүт балапан */
export function Mascot({ size = 120, className = '' }: { size?: number; className?: string }) {
  return <img src={BRAND.mascot} alt="" width={size} height={(size * 340) / 300} className={className} />;
}
