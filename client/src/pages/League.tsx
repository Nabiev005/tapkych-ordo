import { motion } from 'framer-motion';
import { CirclePlay, Swords, Trophy, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LeagueStandings, LeagueTopPlayers, RoundWinner } from '../components/LeagueTable';
import { LangSwitch } from '../components/LangSwitch';
import { Logo, OrnamentBand, SunTunduk } from '../components/Ornament';
import { Button, FullCenter, Spinner } from '../components/ui';
import { fmtDateTime, ky } from '../i18n/ky';
import { api } from '../lib/api';
import type { LeagueView } from '../lib/types';

/** Лиганын ачык бети: таблица, турлар (катышуу шилтемеси менен) жана мыкты оюнчулар */
export default function LeaguePage() {
  const t = ky.league;
  const { code = '' } = useParams();
  const [league, setLeague] = useState<LeagueView | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = () =>
      api
        .get<{ league: LeagueView }>(`/api/league/${code}`)
        .then((r) => setLeague(r.league))
        .catch(() => setError(t.notFound));
    void load();
    // Таблица жандуу: мезгил-мезгили менен жаңыртабыз
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [code]);

  useEffect(() => {
    if (league) document.title = `${league.title} · ${ky.appName}`;
  }, [league]);

  if (error)
    return (
      <FullCenter>
        <Logo size="md" />
        <p className="mt-6 text-xl text-white/70">{error}</p>
      </FullCenter>
    );
  if (!league)
    return (
      <FullCenter>
        <Spinner className="h-12 w-12 text-ordo-gold" />
      </FullCenter>
    );

  const open = league.rounds.filter((r) => r.open);
  const closed = league.rounds.filter((r) => !r.open).reverse();

  return (
    <div className="bg-night min-h-dvh text-white">
      <OrnamentBand />
      <div className="flex items-center justify-between px-4 pt-3">
        <Link to="/">
          <Logo size="sm" />
        </Link>
        <LangSwitch dark />
      </div>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <SunTunduk size={80} />
          <div className="text-sm font-semibold uppercase tracking-[0.25em] text-ordo-sky-light">
            <Swords className="ico" /> {t.badge}
          </div>
          <h1 className="font-display text-4xl font-black text-gold-gradient md:text-6xl">{league.title}</h1>
          {league.description && <p className="max-w-2xl text-lg text-white/70">{league.description}</p>}
        </div>

        {open.length > 0 && (
          <div className="mb-8 grid gap-3 md:grid-cols-2">
            {open.map((r) => (
              <motion.div
                key={r.code}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap items-center gap-4 rounded-3xl bg-gradient-to-br from-ordo-red/80 to-ordo-red-dark p-5 shadow-xl ring-1 ring-white/10"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold uppercase tracking-widest text-white/70">{t.roundOpen}</div>
                  <div className="font-display text-2xl font-black">{r.title}</div>
                  <div className="text-sm text-white/75">
                    {t.questions(r.questions)} · {t.participants(r.participants)}
                    {r.closesAt && <> · {t.closesAt(fmtDateTime(r.closesAt))}</>}
                  </div>
                </div>
                <Link to={`/hw/${r.code}`}>
                  <Button variant="gold" size="lg" icon={<CirclePlay />}>
                    {t.join}
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        <div className="grid min-w-0 gap-6 lg:grid-cols-3">
          <section className="min-w-0 lg:col-span-2">
            <h2 className="mb-3 font-display text-2xl font-bold">
              <Trophy className="ico text-ordo-gold" /> {t.standings}
            </h2>
            <LeagueStandings league={league} dark />
          </section>

          <div className="min-w-0 space-y-6">
            {league.topPlayers.length > 0 && (
              <section className="rounded-3xl bg-white/[0.06] p-5 ring-1 ring-white/10">
                <h2 className="mb-3 font-display text-xl font-bold">{t.topPlayers}</h2>
                <LeagueTopPlayers league={league} dark />
              </section>
            )}
            <section className="rounded-3xl bg-white/[0.06] p-5 ring-1 ring-white/10">
              <h2 className="mb-3 font-display text-xl font-bold">{t.rounds}</h2>
              {league.rounds.length === 0 ? (
                <p className="text-white/55">{t.noRounds}</p>
              ) : (
                <ul className="space-y-3">
                  {[...open]
                    .reverse()
                    .concat(closed)
                    .map((r) => (
                      <li key={r.code} className="border-b border-white/10 pb-3 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{r.title}</span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${r.open ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/10 text-white/60'}`}
                          >
                            {r.open ? t.roundOpen : t.roundClosed}
                          </span>
                        </div>
                        <div className="text-sm text-white/55">
                          <Users className="ico" /> {t.participants(r.participants)}
                        </div>
                        <RoundWinner round={r} dark />
                      </li>
                    ))}
                </ul>
              )}
            </section>
          </div>
        </div>

        <p className="mt-10 text-center text-sm text-white/50">
          {t.footer}{' '}
          <Link to="/" className="font-semibold text-ordo-gold-light hover:underline">
            www.tapkych.com
          </Link>
        </p>
      </div>
      <OrnamentBand flip />
    </div>
  );
}
