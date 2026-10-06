import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Logo, OrnamentBand } from '../../components/Ornament';
import { LangSwitch } from '../../components/LangSwitch';
import { Button } from '../../components/ui';
import { ky } from '../../i18n/ky';
import { ApiError, api } from '../../lib/api';
import Play from './Play';

const KEY = 'ordo_player';
export interface PlayerSession {
  token: string;
  code: string;
  name: string;
}

export const playerSession = {
  get(): PlayerSession | null {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? 'null');
    } catch {
      return null;
    }
  },
  set(s: PlayerSession) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* жеке режим */
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* жеке режим */
    }
  },
};

export default function Join() {
  const [params] = useSearchParams();
  const urlCode = (params.get('code') ?? '').replace(/\D/g, '').slice(0, 6);
  const stored = playerSession.get();
  // Сакталган сессия ушул оюнга тиешелүү болсо — дароо кайра кошулабыз (байланыш үзүлсө да абал сакталат)
  const [session, setSession] = useState<PlayerSession | null>(stored && (!urlCode || stored.code === urlCode) ? stored : null);
  const [notice, setNotice] = useState('');

  if (session)
    return (
      <Play
        session={session}
        onLeave={(msg) => {
          playerSession.clear();
          setSession(null);
          setNotice(msg ?? '');
        }}
      />
    );

  return (
    <JoinForm
      initialCode={urlCode || stored?.code || ''}
      notice={notice}
      onJoined={(s) => {
        playerSession.set(s);
        setNotice('');
        setSession(s);
      }}
    />
  );
}

function JoinForm({ initialCode, notice, onJoined }: { initialCode: string; notice: string; onJoined: (s: PlayerSession) => void }) {
  const t = ky.player;
  const [code, setCode] = useState(initialCode);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.post<{ token: string; player: { name: string }; game: { code: string } }>('/api/join', { code, pin });
      onJoined({ token: r.token, code: r.game.code, name: r.player.name });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ky.errors.UNKNOWN);
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  const digits = (v: string, n: number) => v.replace(/\D/g, '').slice(0, n);

  return (
    <div className="bg-night flex min-h-dvh flex-col text-white">
      <OrnamentBand height={20} />
      <div className="flex justify-end px-4 pt-3">
        <LangSwitch dark />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-8 p-5">
        <Logo size="md" />
        <motion.form onSubmit={submit} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-5">
          <h1 className="text-center font-display text-2xl font-bold">{t.joinTitle}</h1>
          {notice && <div className="rounded-2xl bg-ordo-gold/20 p-4 text-center font-semibold text-ordo-gold-light">{notice}</div>}
          <div>
            <label className="mb-1.5 block font-semibold text-white/70">{t.code}</label>
            <input
              className="w-full rounded-2xl border-2 border-white/15 bg-white/10 px-4 py-4 text-center font-display text-3xl font-bold tracking-[0.4em] text-white outline-none placeholder:text-white/25 focus:border-ordo-gold"
              inputMode="numeric"
              autoComplete="off"
              placeholder={t.codePlaceholder}
              value={code}
              onChange={(e) => setCode(digits(e.target.value, 6))}
            />
          </div>
          <div>
            <label className="mb-1.5 block font-semibold text-white/70">{t.pin}</label>
            <input
              className="w-full rounded-2xl border-2 border-white/15 bg-white/10 px-4 py-4 text-center font-display text-3xl font-bold tracking-[0.6em] text-white outline-none placeholder:text-white/25 focus:border-ordo-gold"
              inputMode="numeric"
              type="password"
              autoComplete="off"
              autoFocus={!!initialCode}
              placeholder={t.pinPlaceholder}
              value={pin}
              onChange={(e) => setPin(digits(e.target.value, 4))}
            />
            <p className="mt-1.5 text-center text-sm text-white/50">🔒 {t.pinHint}</p>
          </div>
          {error && (
            <motion.div initial={{ x: -10 }} animate={{ x: [10, -10, 6, 0] }} className="rounded-2xl bg-ordo-red p-4 text-center font-semibold">
              {error}
            </motion.div>
          )}
          <Button type="submit" size="xl" variant="gold" className="w-full" loading={busy} disabled={code.length !== 6 || pin.length !== 4}>
            {busy ? t.joining : t.join}
          </Button>
        </motion.form>
      </div>
      <OrnamentBand height={20} flip />
    </div>
  );
}
