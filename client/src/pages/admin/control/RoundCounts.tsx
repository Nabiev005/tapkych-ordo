import { ListOrdered, Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { ky, type RoundKey } from '../../../i18n/ky';
import type { AdminState } from '../../../lib/types';

const ROUNDS: RoundKey[] = ['ROUND1', 'ROUND2', 'FINAL'];
const MAX = 50;

/**
 * Турлардагы суроолордун санын −/+ менен өзгөртүү.
 * Лоббиде — жөндөө катары; оюн учурунда — учурдагы жана кийинки турлар үчүн (бүткөн турлар өзгөрбөйт).
 */
export default function RoundCounts({ state, onSet }: { state: AdminState; onSet: (round: RoundKey, count: number) => Promise<unknown> }) {
  const t = ky.admin.control;
  const g = state.game;
  const live = g.status !== 'LOBBY' && g.status !== 'FINISHED';
  const cur = live ? ROUNDS.indexOf(g.round as RoundKey) : -1;
  const [busy, setBusy] = useState<string | null>(null);

  const counts: Record<RoundKey, number> = { ROUND1: g.settings.round1Count, ROUND2: g.settings.round2Count, FINAL: g.settings.finalQuestionCount };

  const change = async (round: RoundKey, count: number) => {
    setBusy(`${round}:${count}`);
    try {
      await onSet(round, count);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="card space-y-3 p-5">
      <div>
        <h3 className="font-display text-lg font-bold">
          <ListOrdered className="ico" /> {t.countsTitle}
        </h3>
        <p className="text-xs text-ordo-ink/50">{t.countsHint}</p>
      </div>
      <div className="space-y-2">
        {ROUNDS.filter((r) => g.settings.mode !== 'BRAIN_RING' || r === 'ROUND1').map((r) => {
          const i = ROUNDS.indexOf(r);
          const isCur = live && i === cur;
          const done = live && (i < cur || (isCur && g.phase === 'ROUND_END'));
          const value = isCur ? g.total : counts[r];
          // Учурдагы турда көрсөтүлгөн (же даярдалган) суроолордон азайтууга болбойт
          const min = isCur ? Math.max(1, g.index + 1) : 1;
          const canAdd = value < MAX && (!live || state.spare > 0);
          return (
            <div key={r} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${isCur ? 'bg-ordo-sky/10 ring-1 ring-ordo-sky/40' : 'bg-ordo-ink/[0.03]'}`}>
              <div className="min-w-0 flex-1">
                <div className={`truncate font-semibold ${done ? 'text-ordo-ink/40' : ''}`}>{ky.rounds[r]}</div>
                {done ? (
                  <div className="text-xs text-ordo-ink/40">{t.countsDone}</div>
                ) : (
                  isCur && g.index >= 0 && <div className="text-xs text-ordo-ink/50">{t.countsAsked(g.index + 1)}</div>
                )}
              </div>
              <StepBtn disabled={done || value <= min || !!busy} onClick={() => change(r, value - 1)} label="−">
                <Minus className="h-4 w-4" />
              </StepBtn>
              <div className="w-10 text-center font-display text-2xl font-black tabular-nums">{value}</div>
              <StepBtn disabled={done || !canAdd || !!busy} onClick={() => change(r, value + 1)} label="+">
                <Plus className="h-4 w-4" />
              </StepBtn>
            </div>
          );
        })}
      </div>
      {live && <div className="text-xs text-ordo-ink/50">{t.countsSpare(state.spare)}</div>}
    </section>
  );
}

function StepBtn({ children, disabled, onClick, label }: { children: React.ReactNode; disabled: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-ordo-ink shadow-sm ring-1 ring-ordo-gold/30 transition hover:bg-ordo-gold/15 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}
