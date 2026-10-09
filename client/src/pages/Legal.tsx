import { Link } from 'react-router-dom';
import { LangSwitch } from '../components/LangSwitch';
import { Logo, OrnamentBand } from '../components/Ornament';
import { ky } from '../i18n/ky';

/** Купуялык саясаты (/privacy) жана колдонуу шарттары (/terms) — Google'дун OAuth талабы боюнча ачык беттер */
export default function Legal({ kind }: { kind: 'privacy' | 'terms' }) {
  const l = ky.legal;
  const title = kind === 'privacy' ? l.privacyTitle : l.termsTitle;
  const sections = kind === 'privacy' ? l.privacy : l.terms;

  return (
    <div className="min-h-dvh bg-ordo-cream">
      <header className="bg-night">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/">
            <Logo size="sm" />
          </Link>
          <LangSwitch dark />
        </div>
        <OrnamentBand height={12} />
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/" className="text-sm font-semibold text-ordo-sky hover:underline">
          {l.back}
        </Link>
        <h1 className="mt-4 font-display text-3xl font-black md:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-ordo-ink/50">{l.updated}</p>

        <div className="card mt-8 space-y-6 p-6 md:p-8">
          {sections.map(([heading, text], i) => (
            <section key={heading}>
              <h2 className="font-display text-lg font-bold">
                {i + 1}. {heading}
              </h2>
              <p className="mt-1.5 leading-relaxed text-ordo-ink/75">{text}</p>
            </section>
          ))}
        </div>

        <nav className="mt-8 flex flex-wrap gap-4 text-sm font-semibold">
          <Link to="/privacy" className="text-ordo-sky hover:underline">
            {l.privacyTitle}
          </Link>
          <Link to="/terms" className="text-ordo-sky hover:underline">
            {l.termsTitle}
          </Link>
        </nav>
      </main>
    </div>
  );
}
