import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { OPTION_STYLE } from '../components/game';
import { LangSwitch } from '../components/LangSwitch';
import { HornMotif, Logo, OrnamentBand, SunTunduk } from '../components/Ornament';
import { ky } from '../i18n/ky';
import { OPTION_KEYS } from '../lib/types';

/** Бөлүм пайда болгондо жумшак көтөрүлүү анимациясы */
function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionTitle({ title, text }: { title: string; text?: string }) {
  return (
    <Reveal className="mx-auto mb-12 max-w-2xl text-center">
      <div className="mb-3 flex justify-center">
        <HornMotif className="w-14 text-ordo-red" width={5} />
      </div>
      <h2 className="font-display text-3xl font-black text-ordo-ink md:text-4xl">{title}</h2>
      {text && <p className="mt-3 text-lg text-ordo-ink/60">{text}</p>}
    </Reveal>
  );
}

export default function Home() {
  const t = ky.landing;
  const h = ky.home;

  return (
    <div className="min-h-dvh bg-ordo-cream text-ordo-ink">
      {/* ─────────── Жогорку тилке — ылдый түшкөндө да ордунда турат ─────────── */}
      <div className="sticky top-0 z-50 text-white shadow-lg">
        <OrnamentBand height={12} bg="#071226" />
        <nav className="border-b border-white/10 bg-ordo-deep/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <a href="#top" aria-label={ky.appName}>
              <Logo size="sm" />
            </a>
            <div className="hidden items-center gap-1 text-sm font-semibold text-white/75 lg:flex">
              {[
                ['#how', t.whatTitle],
                ['#features', t.featuresTitle],
                ['#faq', t.faqTitle],
              ].map(([href, label]) => (
                <a key={href} href={href} className="rounded-lg px-3 py-2 hover:bg-white/10 hover:text-white">
                  {label.replace('?', '')}
                </a>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <LangSwitch dark />
              <Link to="/admin" className="hidden rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/20 hover:bg-white/20 sm:inline-block">
                {h.host}
              </Link>
            </div>
          </div>
        </nav>
      </div>

      {/* ─────────── Башкы блок ─────────── */}
      <header id="top" className="bg-night relative overflow-hidden text-white">

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 lg:grid-cols-2">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-display text-4xl font-black leading-tight md:text-6xl"
            >
              <span className="text-gold-gradient">{t.heroTitle}</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mt-5 max-w-xl text-lg leading-relaxed text-white/75">
              {t.heroText}
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mt-8 flex flex-wrap gap-3">
              <Link to="/join" className="w-full rounded-2xl bg-gradient-to-b from-[#e0213f] to-ordo-red-dark px-6 py-4 text-center sm:w-auto font-display text-lg font-bold shadow-[0_6px_0_#6e0818] transition hover:brightness-110">
                📱 {h.join}
              </Link>
              <Link to="/rating" className="w-full rounded-2xl bg-gradient-to-b from-ordo-gold-light to-ordo-gold px-6 py-4 text-center sm:w-auto font-display text-lg font-bold text-ordo-ink shadow-[0_6px_0_#a07800] transition hover:brightness-105">
                🏆 {h.rating}
              </Link>
              <Link to="/admin" className="w-full rounded-2xl bg-white/10 px-6 py-4 text-center font-display text-lg font-bold ring-2 ring-white/25 sm:w-auto transition hover:bg-white/20">
                🎙️ {h.host}
              </Link>
            </motion.div>
            <div className="mt-8 flex flex-wrap gap-2">
              {t.badges.map((b) => (
                <span key={b} className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/80 ring-1 ring-white/15">
                  ✓ {b}
                </span>
              ))}
            </div>
          </div>

          {/* Иллюстрация: проектор + телефон */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="relative mx-auto w-full max-w-lg">
            <div className="rounded-3xl bg-white/[0.07] p-5 shadow-2xl ring-1 ring-white/15 backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-display text-sm tracking-widest text-ordo-sky-light">{ky.roundsUpper.ROUND1} · 4/10</span>
                <span className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-ordo-sky font-display text-lg font-black">12</span>
              </div>
              <div className="mb-4 font-display text-xl font-bold leading-snug">{t.mockQuestion}</div>
              <div className="grid grid-cols-2 gap-2">
                {OPTION_KEYS.map((k) => (
                  <div key={k} className="flex items-center gap-2 rounded-xl bg-white/[0.07] p-2 ring-1 ring-white/10">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg font-display font-black ${OPTION_STYLE[k].bg}`}>{ky.options[k]}</span>
                    <span className="h-2.5 flex-1 rounded-full bg-white/20" />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {['✓', '✓', '●', '○', '✓', '●'].map((s, i) => (
                  <span key={i} className={`h-6 w-16 rounded-lg ${s === '✓' ? 'bg-emerald-500' : s === '●' ? 'bg-ordo-gold' : 'bg-white/15'}`} />
                ))}
              </div>
            </div>
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 4 }}
              className="absolute -bottom-10 -right-2 w-36 rounded-[1.8rem] bg-ordo-deep p-2.5 shadow-2xl ring-4 ring-white/20 md:-right-8"
            >
              <div className="mb-2 h-1.5 w-10 rounded-full bg-white/20 mx-auto" />
              <div className="grid grid-cols-2 gap-1.5">
                {OPTION_KEYS.map((k) => (
                  <div key={k} className={`flex h-14 items-center justify-center rounded-xl font-display text-2xl font-black ${OPTION_STYLE[k].bg}`}>
                    {ky.options[k]}
                  </div>
                ))}
              </div>
            </motion.div>
            <div className="absolute -left-6 -top-8 hidden md:block">
              <SunTunduk size={80} />
            </div>
          </motion.div>
        </div>
        <OrnamentBand flip />
      </header>

      {/* ─────────── Кантип иштейт ─────────── */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20">
        <SectionTitle title={t.whatTitle} text={t.whatText} />
        <div className="grid gap-6 md:grid-cols-3">
          {t.devices.map((d, i) => (
            <Reveal key={d.title} delay={i * 0.1}>
              <div className="card h-full p-7 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-ordo-night text-3xl shadow-lg">{d.icon}</div>
                <h3 className="font-display text-lg font-bold">{d.title}</h3>
                <p className="mt-2 leading-relaxed text-ordo-ink/65">{d.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─────────── Кантип колдонулат ─────────── */}
      <section className="border-y border-ordo-gold/20 bg-white py-20">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle title={t.howTitle} />
          <div className="grid gap-10 lg:grid-cols-5">
            <Reveal className="lg:col-span-3">
              <h3 className="mb-5 font-display text-xl font-bold text-ordo-red">🎙️ {t.howHostTitle}</h3>
              <ol className="space-y-4">
                {t.howHost.map((s, i) => (
                  <Step key={s.title} n={i + 1} title={s.title} text={s.text} tone="red" />
                ))}
              </ol>
            </Reveal>
            <Reveal delay={0.15} className="lg:col-span-2">
              <h3 className="mb-5 font-display text-xl font-bold text-ordo-sky">📱 {t.howStudentTitle}</h3>
              <ol className="space-y-4">
                {t.howStudent.map((s, i) => (
                  <Step key={s.title} n={i + 1} title={s.title} text={s.text} tone="sky" />
                ))}
              </ol>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─────────── Мүмкүнчүлүктөр ─────────── */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20">
        <SectionTitle title={t.featuresTitle} text={t.featuresText} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 4) * 0.06}>
              <div className="group h-full rounded-3xl bg-white p-5 ring-1 ring-ordo-gold/20 transition hover:-translate-y-1 hover:shadow-xl">
                <div className="mb-3 text-3xl transition group-hover:scale-110">{f.icon}</div>
                <h3 className="font-display font-bold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ordo-ink/60">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─────────── Ким үчүн ─────────── */}
      <section className="bg-night py-20 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal className="mb-12 text-center">
            <h2 className="font-display text-3xl font-black text-gold-gradient md:text-4xl">{t.whoTitle}</h2>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-3">
            {t.who.map((w, i) => (
              <Reveal key={w.title} delay={i * 0.1}>
                <div className="h-full rounded-3xl bg-white/[0.06] p-7 ring-1 ring-white/10">
                  <div className="mb-3 text-5xl">{w.icon}</div>
                  <h3 className="font-display text-xl font-bold">{w.title}</h3>
                  <p className="mt-2 leading-relaxed text-white/70">{w.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── Көп берилүүчү суроолор ─────────── */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-20">
        <SectionTitle title={t.faqTitle} />
        <div className="space-y-3">
          {t.faq.map((f, i) => (
            <Reveal key={f.q} delay={i * 0.05}>
              <details className="group rounded-2xl bg-white p-5 ring-1 ring-ordo-gold/25 open:shadow-lg">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display font-bold">
                  {f.q}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ordo-gold/20 text-lg transition group-open:rotate-45">＋</span>
                </summary>
                <p className="mt-3 leading-relaxed text-ordo-ink/70">{f.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─────────── Чакыруу ─────────── */}
      <section className="px-4 pb-20">
        <Reveal>
          <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-ordo-red to-ordo-red-dark p-10 text-center text-white shadow-2xl">
            <h2 className="font-display text-3xl font-black md:text-4xl">{t.ctaTitle}</h2>
            <p className="mx-auto mt-3 max-w-xl text-lg text-white/80">{t.ctaText}</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link to="/admin" className="rounded-2xl bg-white px-7 py-4 font-display text-lg font-bold text-ordo-red shadow-lg hover:brightness-95">
                🎙️ {h.host}
              </Link>
              <Link to="/join" className="rounded-2xl bg-white/15 px-7 py-4 font-display text-lg font-bold ring-2 ring-white/40 hover:bg-white/25">
                📱 {h.join}
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ─────────── Төмөнкү бөлүк ─────────── */}
      <footer className="bg-night text-white">
        <OrnamentBand height={18} />
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8">
          <div className="flex items-center gap-3">
            <SunTunduk size={42} spin={false} />
            <div>
              <div className="font-display font-black text-gold-gradient">{ky.appNameUpper}</div>
              <div className="text-sm text-white/50">{t.footer}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-white/70">
            <Link to="/join" className="hover:text-white">
              {h.join}
            </Link>
            <Link to="/rating" className="hover:text-white">
              {h.rating}
            </Link>
            <Link to="/admin" className="hover:text-white">
              {h.host}
            </Link>
          </div>
          <div className="text-sm text-white/40">© {new Date().getFullYear()} {ky.appName}</div>
        </div>
      </footer>
    </div>
  );
}

function Step({ n, title, text, tone }: { n: number; title: string; text: string; tone: 'red' | 'sky' }) {
  return (
    <li className="flex gap-4">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-display text-xl font-black text-white shadow-md ${tone === 'red' ? 'bg-ordo-red' : 'bg-ordo-sky'}`}
      >
        {n}
      </span>
      <div className="pt-1">
        <div className="font-display font-bold">{title}</div>
        <p className="mt-0.5 leading-relaxed text-ordo-ink/65">{text}</p>
      </div>
    </li>
  );
}
