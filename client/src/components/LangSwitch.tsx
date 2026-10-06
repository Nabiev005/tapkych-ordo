import { ky } from '../i18n/ky';
import { currentLang, setLang, type Lang } from '../i18n/lang';

/** Тил которгуч: КЫР | РУС */
export function LangSwitch({ dark }: { dark?: boolean }) {
  const btn = (l: Lang) =>
    `px-2.5 py-1 text-xs font-bold transition ${
      currentLang === l ? (dark ? 'bg-white text-ordo-night' : 'bg-ordo-night text-white') : dark ? 'text-white/60 hover:text-white' : 'text-ordo-ink/50 hover:text-ordo-ink'
    }`;
  return (
    <div title={ky.lang.title} className={`inline-flex overflow-hidden rounded-lg ring-1 ${dark ? 'ring-white/30' : 'ring-ordo-ink/15'}`}>
      <button className={btn('ky')} onClick={() => currentLang !== 'ky' && setLang('ky')}>
        {ky.lang.ky}
      </button>
      <button className={btn('ru')} onClick={() => currentLang !== 'ru' && setLang('ru')}>
        {ky.lang.ru}
      </button>
    </div>
  );
}
