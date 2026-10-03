import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Logo, OrnamentBand } from '../components/Ornament';
import { ky } from '../i18n/ky';

export default function Home() {
  return (
    <div className="bg-night flex min-h-dvh flex-col text-white">
      <OrnamentBand />
      <div className="flex flex-1 flex-col items-center justify-center gap-12 p-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <Logo size="lg" />
        </motion.div>
        <div className="grid w-full max-w-2xl gap-5 sm:grid-cols-2">
          {[
            { to: '/join', title: ky.home.join, hint: ky.home.joinHint, icon: '📱', cls: 'from-ordo-red to-ordo-red-dark' },
            { to: '/admin', title: ky.home.host, hint: ky.home.hostHint, icon: '🎙️', cls: 'from-[#1ba4e3] to-[#0b5f8a]' },
          ].map((b, i) => (
            <motion.div key={b.to} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1 }}>
              <Link
                to={b.to}
                className={`block rounded-3xl bg-gradient-to-br ${b.cls} p-7 shadow-2xl ring-2 ring-ordo-gold/40 transition hover:-translate-y-1 hover:ring-ordo-gold`}
              >
                <div className="mb-3 text-5xl">{b.icon}</div>
                <div className="font-display text-2xl font-bold">{b.title}</div>
                <div className="mt-1 text-white/70">{b.hint}</div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
      <OrnamentBand flip />
    </div>
  );
}
