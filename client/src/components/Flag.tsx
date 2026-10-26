import { SUN_CX, SUN_CY, SUN_PATH, SUN_R } from './flagSun';
import type { ReactElement } from 'react';
import type { Lang } from '../i18n/lang';

/**
 * Тилдердин желектери (жөнөкөйлөтүлгөн SVG, 3:2). Эмодзи-желектер Windows'то көрүнбөйт,
 * ошондуктан ар бири өзүнчө тартылган.
 */
export function Flag({ lang, className = 'h-4 w-6' }: { lang: Lang; className?: string }) {
  return (
    <svg viewBox="0 0 60 40" className={`${className} shrink-0 overflow-hidden rounded-[3px] shadow-sm ring-1 ring-black/15`} aria-hidden>
      {FLAGS[lang]}
    </svg>
  );
}

/** Беш учтуу жылдыз (cx, cy борбору, r — сырткы радиусу) */
function star(cx: number, cy: number, r: number, rot = -90) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.4;
    const a = ((rot + i * 36) * Math.PI) / 180;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

const FLAGS: Record<Lang, ReactElement> = {
  // Кыргызстан: кызыл, күн жана түндүк (расмий форма — flagSun.ts)
  ky: (
    <>
      <rect width="60" height="40" fill="#E8112D" />
      <g transform={`translate(30 20) scale(${13 / SUN_R}) translate(${-SUN_CX} ${-SUN_CY})`}>
        <path d={SUN_PATH} fill="#FFEF00" fillRule="evenodd" />
      </g>
    </>
  ),
  // Россия
  ru: (
    <>
      <rect width="60" height="40" fill="#fff" />
      <rect y="13.33" width="60" height="13.34" fill="#0039A6" />
      <rect y="26.67" width="60" height="13.33" fill="#D52B1E" />
    </>
  ),
  // Улуу Британия (англис тили)
  en: (
    <>
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0L60 40M60 0L0 40" stroke="#fff" strokeWidth="8" />
      <path d="M0 0L60 40M60 0L0 40" stroke="#C8102E" strokeWidth="3" />
      <path d="M30 0V40M0 20H60" stroke="#fff" strokeWidth="12" />
      <path d="M30 0V40M0 20H60" stroke="#C8102E" strokeWidth="7" />
    </>
  ),
  // Өзбекстан: көк / ак / жашыл, кызыл ичке сызыктар, ай жана жылдыздар
  uz: (
    <>
      <rect width="60" height="40" fill="#fff" />
      <rect width="60" height="12.8" fill="#0099B5" />
      <rect y="27.2" width="60" height="12.8" fill="#1EB53A" />
      <rect y="12.8" width="60" height="0.9" fill="#CE1126" />
      <rect y="26.3" width="60" height="0.9" fill="#CE1126" />
      <circle cx="9" cy="6.4" r="4.2" fill="#fff" />
      <circle cx="10.6" cy="6.4" r="3.6" fill="#0099B5" />
      {[[15, 9.2], [18.5, 9.2], [22, 9.2], [18.5, 6.2], [22, 6.2], [22, 3.2]].map(([x, y]) => (
        <polygon key={`${x}-${y}`} points={star(x, y, 1.2)} fill="#fff" />
      ))}
    </>
  ),
  // Казакстан: асман көк, алтын күн нурлары менен, сол жагында оюу тилкеси
  kk: (
    <>
      <rect width="60" height="40" fill="#00AFCA" />
      <g fill="#FEC50C">
        {Array.from({ length: 16 }, (_, i) => (
          <rect key={i} x="32.4" y="6.5" width="1.2" height="4" transform={`rotate(${i * 22.5} 33 17)`} />
        ))}
        <circle cx="33" cy="17" r="5.2" />
        <path d="M24 27c3-2 6-2.5 9-1.5 3-1 6-.5 9 1.5-3-.8-6-.6-9 .8-3-1.4-6-1.6-9-.8z" />
        <rect x="4" y="2" width="2.2" height="36" />
      </g>
    </>
  ),
  // Тажикстан: кызыл / ак / жашыл, ортосунда алтын таажы жана жети жылдыз
  tg: (
    <>
      <rect width="60" height="40" fill="#fff" />
      <rect width="60" height="11.4" fill="#CC0000" />
      <rect y="28.6" width="60" height="11.4" fill="#006600" />
      <g fill="#F8C300">
        <path d="M25.5 23.2h9l-.6-2.4-1.6 1-1.3-2.3-1 2.2-1-2.2-1.3 2.3-1.6-1z" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const a = ((200 + i * 23.3) * Math.PI) / 180;
          return <polygon key={i} points={star(30 + 7 * Math.cos(a), 21 + 7 * Math.sin(a), 1)} />;
        })}
      </g>
    </>
  ),
  // Түркия: кызыл, ак ай жана жылдыз
  tr: (
    <>
      <rect width="60" height="40" fill="#E30A17" />
      <circle cx="22" cy="20" r="10" fill="#fff" />
      <circle cx="24.5" cy="20" r="8" fill="#E30A17" />
      <polygon points={star(34.5, 20, 4.4, 180)} fill="#fff" />
    </>
  ),
};
