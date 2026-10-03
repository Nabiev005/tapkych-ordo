import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { CornerOrnament, SunTunduk } from '../../components/Ornament';
import { Button, Spinner } from '../../components/ui';
import { ky } from '../../i18n/ky';
import { api, getJoinBase } from '../../lib/api';
import type { GameRow } from '../../lib/types';

/** Басып чыгаруу үчүн PIN карточкалары — ар бир оюнчуга өзүнчө кесип берилет */
export default function Pins() {
  const { id } = useParams();
  const t = ky.admin.pins;
  const [game, setGame] = useState<GameRow | null>(null);
  const [base, setBase] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<{ game: GameRow }>(`/api/games/${id}`)
      .then((r) => setGame(r.game))
      .catch((e) => setError(e.message));
    void getJoinBase().then(setBase);
  }, [id]);

  if (error) return <div className="p-10 text-center text-ordo-red">{error}</div>;
  if (!game || !base)
    return (
      <div className="flex justify-center p-20">
        <Spinner className="h-10 w-10 text-ordo-red" />
      </div>
    );

  const url = `${base}/join?code=${game.code}`;
  const players = game.players.filter((p) => p.status !== 'KICKED');

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black">{t.title}</h1>
          <p className="max-w-2xl text-ordo-ink/60">{t.hint}</p>
        </div>
        <Button size="lg" icon="🖨" onClick={() => window.print()}>
          {ky.common.print}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {players.map((p) => (
          <div key={p.id} className="relative break-inside-avoid overflow-hidden rounded-2xl border-2 border-dashed border-ordo-red/40 bg-white p-5">
            <CornerOrnament className="absolute -left-1 -top-1 h-14 w-14" color="#c8102e" />
            <CornerOrnament className="absolute -right-1 -top-1 h-14 w-14 -scale-x-100" color="#c8102e" />
            <div className="flex items-center justify-center gap-2">
              <SunTunduk size={34} spin={false} />
              <div className="font-display text-lg font-black text-ordo-red">{ky.appNameUpper}</div>
            </div>
            <div className="mt-3 text-center text-xl font-bold">{p.name}</div>
            <div className="mt-3 flex items-center gap-4">
              <QRCodeSVG value={url} size={92} />
              <div className="flex-1 space-y-1.5 text-sm">
                <div>
                  {t.card.site}: <span className="break-all font-mono font-semibold">{base}/join</span>
                </div>
                <div>
                  {t.card.code}: <span className="font-mono text-lg font-bold tracking-widest">{game.code}</span>
                </div>
                <div className="rounded-xl bg-ordo-gold/20 px-3 py-1.5">
                  {t.card.pin}: <span className="font-mono text-2xl font-black tracking-[0.3em] text-ordo-red">{p.pin}</span>
                </div>
              </div>
            </div>
            <div className="mt-2 text-center text-xs text-ordo-ink/50">🔒 {t.card.secret}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
