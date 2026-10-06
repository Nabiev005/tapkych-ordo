/** Интерфейстин тили: кыргызча (демейки) же орусча. Ар бир түзмөктө өзүнчө сакталат. */
export type Lang = 'ky' | 'ru';

const KEY = 'ordo_lang';

function read(): Lang {
  try {
    return localStorage.getItem(KEY) === 'ru' ? 'ru' : 'ky';
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

export const dateLocale = currentLang === 'ru' ? 'ru-RU' : 'ky-KG';
