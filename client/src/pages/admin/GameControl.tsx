import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, ConnBadge, Spinner, useDialogs } from '../../components/ui';
import { ky } from '../../i18n/ky';
import { adminToken } from '../../lib/api';
import type { AdminState } from '../../lib/types';
import { useGameSocket } from '../../lib/useGameSocket';
import LobbyPanel from './control/LobbyPanel';
import LivePanel from './control/LivePanel';
import ResultsPanel from './control/ResultsPanel';

export type Act = (action: Record<string, unknown> & { type: string }) => Promise<boolean>;

export default function GameControl() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useDialogs();
  const token = adminToken.get();
  const gameId = Number(id);
  const [busy, setBusy] = useState<string | null>(null);

  const { state, status, offset, emit } = useGameSocket<AdminState>(token && gameId ? { role: 'admin', token, gameId } : null, {
    'game:deleted': () => navigate('/admin'),
  });

  useEffect(() => {
    if (status === 'denied') navigate('/admin');
  }, [status, navigate]);

  /** Аракетти серверге жөнөтүү. Ката болсо кыргызча билдирүү көрсөтүлөт. */
  const act: Act = useCallback(
    async (action) => {
      setBusy(action.type);
      try {
        await emit('admin:action', action);
        return true;
      } catch (e) {
        toast((e as Error).message, 'err');
        return false;
      } finally {
        setBusy(null);
      }
    },
    [emit, toast],
  );

  if (!state)
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-10 w-10 text-ordo-red" />
      </div>
    );

  const g = state.game;
  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={() => navigate('/admin')}>
          ←
        </Button>
        <div className="rounded-2xl bg-ordo-night px-4 py-2 font-display text-lg font-bold tracking-[0.3em] text-ordo-gold">{g.code}</div>
        <div className="font-semibold text-ordo-ink/60">
          {g.title && <span className="mr-2 font-display text-ordo-ink">{g.title}</span>}
          {ky.admin.dashboard.status[g.status]}
        </div>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => window.open(`/screen/${g.code}`, '_blank')}>
          🖥 {ky.admin.control.screenLink}
        </Button>
        <Button
          variant={g.soundEnabled ? 'gold' : 'outline'}
          size="sm"
          onClick={() => act({ type: 'setSound', enabled: !g.soundEnabled })}
          title={ky.admin.control.soundToggle}
        >
          {g.soundEnabled ? '🔊' : '🔇'} {g.soundEnabled ? ky.common.soundOn : ky.common.soundOff}
        </Button>
      </div>

      {g.status === 'LOBBY' && <LobbyPanel state={state} act={act} busy={busy} />}
      {(g.status === 'ROUND1' || g.status === 'ROUND2' || g.status === 'FINAL') && <LivePanel state={state} act={act} busy={busy} offset={offset} />}
      {g.status === 'FINISHED' && <ResultsPanel state={state} act={act} />}

      <ConnBadge status={status} />
    </div>
  );
}
