import { motion } from 'framer-motion';
import { Swords } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal, Spinner, useDialogs } from '../../components/ui';
import { fmtDateTime, ky } from '../../i18n/ky';
import { api } from '../../lib/api';
import type { LeagueRow, LeagueView } from '../../lib/types';

export default function Leagues() {
  const t = ky.admin.leagues;
  const navigate = useNavigate();
  const { toast } = useDialogs();
  const [list, setList] = useState<LeagueRow[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api
      .get<{ leagues: LeagueRow[] }>('/api/leagues')
      .then((r) => setList(r.leagues))
      .catch((e) => toast(e.message, 'err'));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black">
            <Swords className="ico text-ordo-red" /> {t.title}
          </h1>
          <p className="max-w-3xl text-ordo-ink/60">{t.hint}</p>
        </div>
        <Button variant="red" icon="＋" onClick={() => setCreating(true)}>
          {t.create}
        </Button>
      </div>

      {!list ? (
        <Spinner />
      ) : list.length === 0 ? (
        <div className="card p-10 text-center text-ordo-ink/60">{t.empty}</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((l, i) => (
            <motion.button
              key={l.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => navigate(`/admin/leagues/${l.id}`)}
              className="card p-5 text-left transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-display text-lg font-bold">
                    <Swords className="ico text-ordo-red" /> {l.title}
                  </div>
                  <div className="text-sm text-ordo-ink/50">{fmtDateTime(l.createdAt)}</div>
                </div>
                <span className="rounded-lg bg-ordo-night px-2.5 py-0.5 font-mono text-sm font-bold tracking-widest text-ordo-gold">{l.code}</span>
              </div>
              <div className="mt-3 text-sm text-ordo-ink/70">{t.stats(l.schools, l.rounds, l.participants)}</div>
            </motion.button>
          ))}
        </div>
      )}

      <LeagueModal open={creating} onClose={() => setCreating(false)} onSaved={(id) => navigate(`/admin/leagues/${id}`)} />
    </div>
  );
}

/** Лиганы түзүү же түзөтүү (league берилсе — түзөтүү) */
export function LeagueModal({ open, onClose, onSaved, league }: { open: boolean; onClose: () => void; onSaved: (id: number) => void; league?: LeagueView }) {
  const t = ky.admin.leagues;
  const { toast } = useDialogs();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [schools, setSchools] = useState('');
  const [topN, setTopN] = useState(5);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(league?.title ?? '');
    setDescription(league?.description ?? '');
    setSchools((league?.schools ?? []).join('\n'));
    setTopN(league?.topN ?? 5);
  }, [open]);

  const list = [
    ...new Set(
      schools
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  const valid = title.trim() && list.length >= 2;

  const save = async () => {
    setBusy(true);
    try {
      const body = { title, description, schools: list, topN };
      if (league?.id) {
        await api.patch(`/api/leagues/${league.id}`, body);
        onSaved(league.id);
      } else {
        const r = await api.post<{ league: { id: number } }>('/api/leagues', body);
        onSaved(r.league.id);
      }
      onClose();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={league ? t.edit : t.create}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) void save();
        }}
      >
        <div>
          <label className="label">{t.titleLabel}</label>
          <input className="input" autoFocus placeholder={t.titlePlaceholder} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">{t.description}</label>
          <input className="input" placeholder={t.descriptionPlaceholder} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="label">
            {t.schools} <span className="font-normal text-ordo-ink/50">· {list.length}</span>
          </label>
          <textarea className="input min-h-40 leading-7" placeholder={t.schoolsPlaceholder} value={schools} onChange={(e) => setSchools(e.target.value)} />
          <p className="mt-1 text-xs text-ordo-ink/50">{t.schoolsHint}</p>
        </div>
        <div>
          <label className="label">{t.topN}</label>
          <input
            type="number"
            min={1}
            max={50}
            className="input w-28"
            value={topN}
            onChange={(e) => setTopN(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
          />
          <p className="mt-1 text-xs text-ordo-ink/50">{t.topNHint(topN)}</p>
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            {ky.common.cancel}
          </Button>
          <Button type="submit" variant="green" size="lg" loading={busy} disabled={!valid}>
            {league ? ky.common.save : t.createBtn}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
