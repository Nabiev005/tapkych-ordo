/** Интерфейстин тили. Ар бир түзмөктө өзүнчө сакталат (localStorage `ordo_lang`), демейки — кыргызча. */
export type Lang = 'ky' | 'ru' | 'en' | 'uz' | 'kk' | 'tg' | 'tr';

/**
 * Тилдердин тизмеси: тандоочуда ушул тартипте чыгат.
 * name — тилдин өз аталышы (ар бир тилде бирдей көрсөтүлөт), short — баскычтагы кыска белги.
 */
export const LANGS: { code: Lang; name: string; short: string; locale: string; google: string }[] = [
  { code: 'ky', name: 'Кыргызча', short: 'КЫР', locale: 'ky-KG', google: 'ky' },
  { code: 'ru', name: 'Русский', short: 'РУС', locale: 'ru-RU', google: 'ru' },
  { code: 'en', name: 'English', short: 'ENG', locale: 'en-GB', google: 'en' },
  { code: 'uz', name: 'Oʻzbekcha', short: 'OʻZB', locale: 'uz-Latn-UZ', google: 'uz' },
  { code: 'kk', name: 'Қазақша', short: 'ҚАЗ', locale: 'kk-KZ', google: 'kk' },
  { code: 'tg', name: 'Тоҷикӣ', short: 'ТОҶ', locale: 'tg-TJ', google: 'tg' },
  { code: 'tr', name: 'Türkçe', short: 'TÜR', locale: 'tr-TR', google: 'tr' },
];

const KEY = 'ordo_lang';

function read(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    return LANGS.some((l) => l.code === v) ? (v as Lang) : 'ky';
  } catch {
    return 'ky';
  }
}

export const currentLang: Lang = read();

if (typeof document !== 'undefined') document.documentElement.lang = currentLang;

/** Тилди алмаштыруу — бет кайра жүктөлөт */
export function setLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* жеке режим */
  }
  location.reload();
}

const info = LANGS.find((l) => l.code === currentLang) ?? LANGS[0];
export const dateLocale = info.locale;
export const googleLocale = info.google;
