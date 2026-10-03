import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { JoinQr } from '../../../components/game';
import { Button, useDialogs } from '../../../components/ui';
import { ky, type RoundKey } from '../../../i18n/ky';
import { api, getJoinBase } from '../../../lib/api';
import type { AdminState } from '../../../lib/types';
import type { Act } from '../GameControl';

export default function LobbyPanel({ state, act, busy }: { state: AdminState; act: Act; busy: string | null }) {
  const t = ky.admin.control;
  const { confirm, prompt, toast } = useDialogs();
  const g = state.game;
  const [base, setBase] = useState('');
  useEffect(() => {
    void getJoinBase().then(setBase);
  }, []);
  const joinUrl = `${base}/join?code=${g.code}`;

  const players = state.players.filter((p) => p.status !== 'KICKED');
  const joined = players.filter((p) => p.joined).length;

  const need: Record<RoundKey, number> = { ROUND1: g.settings.round1Count, ROUND2: g.settings.round2Count, FINAL: g.settings.finalQuestionCount };
  const blockers = (Object.keys(need) as RoundKey[]).filter((r) => state.bank[r] < need[r]).map((r) => ky.notEnoughQuestions(r, need[r], state.bank[r]));
  if (players.length < 2) blockers.push(ky.admin.newGame.needPlayers);

  const rest = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  const start = async () => {
    const ok = await confirm({ title: t.startConfirmTitle, message: t.startConfirm(joined, players.length), confirmText: t.start });
    if (ok) await act({ type: 'startGame' });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      {/* Кошулуу маалыматы */}
      <section className="relative overflow-hidden rounded-3xl bg-night p-6 text-white shadow-xl lg:col-span-2">
        <div className="text-sm font-semibold uppercase tracking-widest text-ordo-sky-light">{t.joinCode}</div>
        <div className="font-display text-6xl font-black tracking-[0.15em] text-gold-gradient">{g.code}</div>
        <div className="mt-5 flex flex-col items-center gap-3">
          {base && <JoinQr url={joinUrl} size={180} />}
          <div className="text-center text-sm text-white/60">{t.joinAddress}</div>
          <div className="break-all text-center font-mono text-lg text-ordo-gold-light">{base ? `${base}/join` : '…'}</div>
        </div>
        <div className="mt-6 grid gap-2">
          <Button variant="gold" size="lg" icon="🖥" onClick={() => window.open(`/screen/${g.code}`, '_blank')}>
            {t.openScreen}
          </Button>
          <p className="text-center text-xs text-white/50">{t.openScreenHint}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="dark"
              size="sm"
              onClick={() =>
                navigator.clipboard
                  ?.writeText(joinUrl)
                  .then(() => toast(t.copied))
                  .catch(() => undefined)
              }
            >
              🔗 {t.copyLink}
            </Button>
            <Button variant="dark" size="sm" onClick={() => window.open(`/admin/games/${g.id}/pins`, '_blank')}>
              🖨 {t.printPins}
            </Button>
          </div>
        </div>
      </section>

      {/* Оюнчулар */}
      <section className="card p-6 lg:col-span-3">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold">{t.playersJoined(joined, players.length)}</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const name = await prompt({ title: t.addPlayer, label: t.addPlayerPlaceholder, confirmText: ky.common.add });
              if (name) await rest(() => api.post(`/api/games/${g.id}/players`, { name }));
            }}
          >
            ＋ {t.addPlayer}
          </Button>
        </div>
        <div className="mb-4 h-3 overflow-hidden rounded-full bg-ordo-gold/15">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-ordo-sky to-emerald-500" animate={{ width: `${players.length ? (joined / players.length) * 100 : 0}%` }} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <AnimatePresence>
            {players.map((p) => (
              <motion.div
                layout
                key={p.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className={`group flex items-center gap-3 rounded-2xl border-2 p-3 ${p.joined ? 'border-emerald-300 bg-emerald-50' : 'border-ordo-gold/20 bg-white'}`}
              >
                <span className={`h-3 w-3 shrink-0 rounded-full ${p.online ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : p.joined ? 'bg-amber-400' : 'bg-slate-300'}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="text-xs text-ordo-ink/50">
                    PIN: <span className="font-mono font-bold tracking-widest text-ordo-ink">{p.pin}</span> · {p.joined ? t.joined : t.notJoined}
                  </div>
                </div>
                <div className="flex gap-0.5 opacity-60 transition group-hover:opacity-100">
                  <IconBtn
                    title={t.rename}
                    onClick={async () => {
                      const name = await prompt({ title: t.rename, defaultValue: p.name, confirmText: ky.common.save });
                      if (name && name !== p.name) await rest(() => api.patch(`/api/games/${g.id}/players/${p.id}`, { name }));
                    }}
                  >
                    ✏️
                  </IconBtn>
                  <IconBtn
                    title={t.newPin}
                    onClick={async () => {
                      if (await confirm({ title: t.newPin, message: t.newPinConfirm(p.name) })) await rest(() => api.post(`/api/games/${g.id}/players/${p.id}/new-pin`));
                    }}
                  >
                    🔄
                  </IconBtn>
                  <IconBtn
                    title={t.removePlayer}
                    onClick={async () => {
                      if (await confirm({ title: t.removePlayer, message: t.removePlayerConfirm(p.name), danger: true, confirmText: ky.common.delete }))
                        await rest(() => api.del(`/api/games/${g.id}/players/${p.id}`));
                    }}
                  >
                    🗑
                  </IconBtn>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>

      {/* Баштоо */}
      <section className="lg:col-span-5">
        {blockers.length > 0 && (
          <div className="mb-3 rounded-2xl bg-ordo-red/10 p-4 font-semibold text-ordo-red">
            {t.startBlocked}
            <ul className="mt-1 list-disc pl-6 font-normal">
              {blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="mb-2 text-center text-sm text-ordo-ink/50">{t.settingsSummary(g.settings.pointsPerCorrect, g.settings.timerSeconds)}</div>
        <Button size="xl" variant="green" className="w-full py-8 text-3xl" pulse={blockers.length === 0} disabled={blockers.length > 0} loading={busy === 'startGame'} onClick={start}>
          ▶ {t.start}
        </Button>
      </section>
    </div>
  );
}

function IconBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button title={title} onClick={onClick} className="rounded-lg p-1.5 text-lg hover:bg-ordo-gold/20">
      {children}
    </button>
  );
}
