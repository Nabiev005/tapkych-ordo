import { ArrowLeft, ClipboardList, Copy, ExternalLink, Pencil, Swords, Trash2, Trophy, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LeagueStandings, LeagueTopPlayers, RoundWinner } from '../../components/LeagueTable';
import { Button, Spinner, useDialogs } from '../../components/ui';
import { fmtDateTime, ky } from '../../i18n/ky';
import { api } from '../../lib/api';
import type { LeagueView } from '../../lib/types';
import { AssignmentFormModal } from './Assignments';
import { LeagueModal } from './Leagues';

export default function LeagueDetail() {
  const t = ky.admin.leagues;
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { confirm, toast } = useDialogs();
  const [league, setLeague] = useState<LeagueView | null>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(
    () =>
      api
        .get<{ league: LeagueView }>(`/api/leagues/${id}`)
        .then((r) => setLeague(r.league))
        .catch((e) => toast(e.message, 'err')),
    [id],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const copy = (text: string) =>
    navigator.clipboard
      .writeText(text)
      .then(() => toast(t.copied))
      .catch(() => toast(text));

  const remove = async () => {
    if (
      !league ||
      !(await confirm({
        title: t.delete,
        message: t.deleteConfirm(league.title),
        danger: true,
        confirmText: ky.common.delete,
      }))
    )
      return;
    await api.del(`/api/leagues/${id}`).catch((e) => toast(e.message, 'err'));
    navigate('/admin/leagues');
  };

  if (!league)
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-10 w-10 text-ordo-red" />
      </div>
    );

  const publicUrl = `${location.origin}/league/${league.code}`;

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/admin/leagues" className="rounded-xl p-2 hover:bg-ordo-gold/15" title={t.back}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-black">
            <Swords className="ico text-ordo-red" /> {league.title}
          </h1>
          {league.description && <p className="text-ordo-ink/60">{league.description}</p>}
        </div>
        <Button variant="outline" icon={<Pencil />} onClick={() => setEditing(true)}>
          {ky.common.edit}
        </Button>
        <Button variant="outline" icon={<Trash2 />} onClick={remove}>
          {t.delete}
        </Button>
      </div>

      <section className="flex flex-wrap items-center gap-4 rounded-3xl bg-night p-5 text-white shadow-xl">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold uppercase tracking-widest text-ordo-sky-light">{t.publicLink}</div>
          <div className="mt-1 break-all font-mono text-lg text-ordo-gold-light">{publicUrl}</div>
          <p className="mt-1 max-w-2xl text-sm text-white/60">{t.publicHint}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="gold" icon={<Copy />} onClick={() => copy(publicUrl)}>
            {t.copy}
          </Button>
          <a href={publicUrl} target="_blank" rel="noreferrer">
            <Button variant="sky" icon={<ExternalLink />}>
              {t.open}
            </Button>
          </a>
        </div>
      </section>

      <div className="grid min-w-0 gap-6 xl:grid-cols-5">
        <section className="card min-w-0 p-5 xl:col-span-3">
          <h2 className="mb-4 font-display text-lg font-bold">
            <Trophy className="ico text-ordo-gold" /> {t.standings}
          </h2>
          <LeagueStandings league={league} />
        </section>

        <div className="min-w-0 space-y-6 xl:col-span-2">
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold">{t.rounds}</h2>
              <Button variant="red" size="sm" icon="＋" onClick={() => setAdding(true)}>
                {t.addRound}
              </Button>
            </div>
            {league.rounds.length === 0 ? (
              <p className="text-sm text-ordo-ink/55">{t.noRounds}</p>
            ) : (
              <ul className="space-y-3">
                {[...league.rounds].reverse().map((r) => (
                  <li key={r.code} className="rounded-2xl p-3 ring-1 ring-ordo-gold/20">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{r.title}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${r.open ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}
                      >
                        {r.open ? ky.league.roundOpen : ky.league.roundClosed}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-ordo-ink/55">
                      <span>{ky.league.questions(r.questions)}</span>
                      <span>
                        <Users className="ico" /> {ky.league.participants(r.participants)}
                      </span>
                      {r.closesAt && <span>{ky.league.closesAt(fmtDateTime(r.closesAt))}</span>}
                    </div>
                    <RoundWinner round={r} />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" icon={<Copy />} onClick={() => copy(`${location.origin}/hw/${r.code}`)}>
                        {t.roundLink}
                      </Button>
                      <Button variant="outline" size="sm" icon={<ClipboardList />} onClick={() => navigate(`/admin/assignments/${r.id}`)}>
                        {t.results}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {league.topPlayers.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-3 font-display text-lg font-bold">{ky.league.topPlayers}</h2>
              <LeagueTopPlayers league={league} />
            </section>
          )}
        </div>
      </div>

      <LeagueModal open={editing} onClose={() => setEditing(false)} onSaved={() => void load()} league={league} />
      <AssignmentFormModal
        open={adding}
        onClose={() => setAdding(false)}
        title={t.addRound}
        defaultTitle={t.roundDefault(league.rounds.length + 1)}
        onSubmit={async (body) => {
          await api.post(`/api/leagues/${id}/rounds`, body);
          setAdding(false);
          void load();
        }}
      />
    </div>
  );
}
