import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Languages } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ky } from '../i18n/ky';
import { LANGS, currentLang, setLang } from '../i18n/lang';
import { Flag } from './Flag';

/**
 * Тил тандоочу: учурдагы тилдин желеги, басканда — бардык тилдердин тизмеси желектери менен.
 * up — тизме өйдө ачылат (мис. каптал менюнун ылдый жагында).
 */
export function LangSwitch({ dark, up }: { dark?: boolean; up?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cur = LANGS.find((l) => l.code === currentLang) ?? LANGS[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={ky.lang.title}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ring-1 transition ${
          dark ? 'text-white ring-white/30 hover:bg-white/10' : 'text-ordo-ink ring-ordo-ink/15 hover:bg-ordo-ink/5'
        }`}
      >
        <Flag lang={cur.code} className="h-3.5 w-5" />
        {cur.short}
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="inline-flex">
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, scale: 0.92, y: up ? 8 : -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: up ? 8 : -8 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            className={`absolute right-0 z-[60] w-52 overflow-hidden rounded-2xl bg-white p-1.5 text-ordo-ink shadow-2xl ring-1 ring-black/10 ${up ? 'bottom-full mb-2 origin-bottom-right' : 'top-full mt-2 origin-top-right'}`}
          >
            <li className="flex items-center gap-1.5 px-2.5 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-widest text-ordo-ink/40">
              <Languages className="h-3.5 w-3.5" /> {ky.lang.title}
            </li>
            {LANGS.map((l, i) => {
              const on = l.code === currentLang;
              return (
                <motion.li key={l.code} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * i }}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => (on ? setOpen(false) : setLang(l.code))}
                    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition ${on ? 'bg-ordo-gold/20 font-bold' : 'hover:bg-ordo-ink/5'}`}
                  >
                    <motion.span whileHover={{ scale: 1.15, rotate: -4 }} className="inline-flex">
                      <Flag lang={l.code} className="h-5 w-7" />
                    </motion.span>
                    <span className="flex-1">{l.name}</span>
                    {on && <Check className="h-4 w-4 text-emerald-600" />}
                  </button>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
