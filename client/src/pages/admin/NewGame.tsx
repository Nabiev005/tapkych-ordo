import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, useDialogs } from '../../components/ui';
import { ky, type RoundKey } from '../../i18n/ky';
import { api } from '../../lib/api';
import type { GameRow, Settings } from '../../lib/types';

const DEFAULTS: Omit<Settings, 'soundEnabled'> = {
  pointsPerCorrect: 1,
  timerSeconds: 15,
  round1Count: 10,
  round2Count: 10,
  finalQuestionCount: 5,
  advanceToRound2: 6,
  advanceToFinal: 3,
  expectedPlayers: 12,
};

const FIELDS: { key: keyof typeof DEFAULTS; min: number; max: number }[] = [
  { key: 'pointsPerCorrect', min: 1, max: 100 },
  { key: 'timerSeconds', min: 5, max: 120 },
  { key: 'expectedPlayers', min: 2, max: 100 },
  { key: 'round1Count', min: 1, max: 50 },
  { key: 'round2Count', min: 1, max: 50 },
  { key: 'finalQuestionCount', min: 1, max: 50 },
  { key: 'advanceToRound2', min: 2, max: 100 },
  { key: 'advanceToFinal', min: 1, max: 100 },
];

export default function NewGame() {
  const t = ky.admin.newGame;
  const navigate = useNavigate();
  const { toast } = useDialogs();
  const [names, setNames] = useState('');
  const [s, setS] = useState(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [bank, setBank] = useState<Record<RoundKey, number> | null>(null);

  useEffect(() => {
    api
      .get<{ summary: { round: RoundKey; count: number }[] }>('/api/questions/summary')
      .then((r) => setBank(Object.fromEntries(r.summary.map((x) => [x.round, x.count])) as Record<RoundKey, number>))
      .catch(() => undefined);
  }, []);

  const players = useMemo(
    () =>
      names
        .split('\n')
        .map((n) => n.trim())
        .filter(Boolean),
    [names],
  );

  const need: Record<RoundKey, number> = { ROUND1: s.round1Count, ROUND2: s.round2Count, FINAL: s.finalQuestionCount };
  const lacking = bank ? (Object.keys(need) as RoundKey[]).filter((r) => bank[r] < need[r]) : [];

  const create = async () => {
    if (players.length < 2) return toast(t.needPlayers, 'err');
    setBusy(true);
    try {
      const { game } = await api.post<{ game: GameRow }>('/api/games', { players, settings: s });
      navigate(`/admin/games/${game.id}`);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate('/admin')}>
          ← {ky.common.back}
        </Button>
        <h1 className="font-display text-2xl font-black">{t.title}</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-5">
        <section className="card space-y-3 p-6 md:col-span-3">
          <h2 className="font-display text-lg font-bold">👥 {t.playersTitle}</h2>
          <p className="text-sm text-ordo-ink/60">{t.playersHint}</p>
          <textarea className="input min-h-80 font-medium leading-8" placeholder={t.playersPlaceholder} value={names} onChange={(e) => setNames(e.target.value)} autoFocus />
          <div className={`font-semibold ${players.length === s.expectedPlayers ? 'text-emerald-600' : 'text-ordo-ink/60'}`}>{t.count(players.length, s.expectedPlayers)}</div>
        </section>

        <section className="card space-y-4 p-6 md:col-span-2">
          <h2 className="font-display text-lg font-bold">⚙️ {t.settings}</h2>
          <p className="text-sm text-ordo-ink/60">{t.settingsHint}</p>
          <div className="space-y-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-3">
                <label className="text-sm font-semibold text-ordo-ink/70">{t[f.key]}</label>
                <input
                  type="number"
                  className="input w-24 py-2 text-center"
                  min={f.min}
                  max={f.max}
                  value={s[f.key]}
                  onChange={(e) => setS({ ...s, [f.key]: Math.max(f.min, Math.min(f.max, Number(e.target.value) || f.min)) })}
                />
              </div>
            ))}
          </div>
        </section>
      </div>

      {lacking.length > 0 && (
        <div className="rounded-2xl bg-ordo-gold/20 p-4 text-ordo-ink">
          ⚠ {t.bankWarn}
          <ul className="mt-1 list-disc pl-6">
            {lacking.map((r) => (
              <li key={r}>{ky.notEnoughQuestions(r, need[r], bank![r])}</li>
            ))}
          </ul>
        </div>
      )}

      <Button size="xl" variant="red" className="w-full" loading={busy} disabled={players.length < 2} onClick={create}>
        {busy ? t.creating : t.create}
      </Button>
    </div>
  );
}
