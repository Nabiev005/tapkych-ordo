import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Spinner, useDialogs } from '../../components/ui';
import { ky, type Difficulty, type QuestionType, type RoundKey } from '../../i18n/ky';
import { api, assetUrl, staffUser } from '../../lib/api';
import { DIFFICULTIES, QUESTION_TYPES, ROUND_KEYS, type LibraryItem } from '../../lib/types';
import { OptionsPreview, QuestionBadges, QuestionForm, emptyDraft, type Draft } from './Questions';

type Tab = 'LIBRARY' | 'PENDING' | 'MINE';
type RoundChoice = 'AUTO' | RoundKey;

interface ListResponse {
  items: LibraryItem[];
  total: number;
  categories: { name: string; count: number }[];
  pendingCount: number;
  inBank: number[];
}

const PAGE = 50;

/** Жалпы суроолор китепканасы: даяр суроолорду өз банкына көчүрүү жана модерация */
export default function Library() {
  const t = ky.admin.library;
  const navigate = useNavigate();
  const { confirm, toast } = useDialogs();
  const isAdmin = staffUser.get()?.role !== 'teacher';

  const [tab, setTab] = useState<Tab>('LIBRARY');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('');
  const [type, setType] = useState<QuestionType | ''>('');
  const [data, setData] = useState<ListResponse | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [round, setRound] = useState<RoundChoice>('AUTO');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Издөө: жазып бүткөндөн кийин гана сурайбыз
  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const query = (offset: number) => {
    const p = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
    if (tab === 'PENDING') p.set('status', 'PENDING');
    if (tab === 'MINE') p.set('mine', '1');
    if (q) p.set('q', q);
    if (category) p.set('category', category);
    if (difficulty) p.set('difficulty', difficulty);
    if (type) p.set('type', type);
    return `/api/library?${p}`;
  };

  const load = () => {
    setSelected(new Set());
    return api
      .get<ListResponse>(query(0))
      .then(setData)
      .catch((e) => toast(e.message, 'err'));
  };
  useEffect(() => {
    setData(null);
    void load();
  }, [tab, q, category, difficulty, type]);

  const loadMore = async () => {
    if (!data) return;
    setLoadingMore(true);
    try {
      const more = await api.get<ListResponse>(query(data.items.length));
      setData({ ...more, items: [...data.items, ...more.items] });
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setLoadingMore(false);
    }
  };

  const inBank = useMemo(() => new Set(data?.inBank ?? []), [data]);
  const canSelect = (x: LibraryItem) => (tab === 'LIBRARY' && !inBank.has(x.id)) || (tab === 'PENDING' && isAdmin);
  const selectable = (data?.items ?? []).filter(canSelect);
  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const copy = () =>
    run(async () => {
      const r = await api.post<{ copied: number; skipped: number }>('/api/library/copy', { ids: [...selected], round });
      toast(t.copied(r.copied, r.skipped));
      await load();
    });

  const approve = () =>
    run(async () => {
      const r = await api.post<{ approved: number }>('/api/library/approve', { ids: [...selected] });
      toast(t.approved(r.approved));
      await load();
    });

  const reject = async () => {
    if (!(await confirm({ title: t.reject(selected.size), message: t.rejectConfirm(selected.size), danger: true, confirmText: t.reject(selected.size) }))) return;
    await run(async () => {
      const r = await api.post<{ rejected: number }>('/api/library/reject', { ids: [...selected] });
      toast(t.rejected(r.rejected));
      await load();
    });
  };

  const remove = async (x: LibraryItem) => {
    const own = !isAdmin;
    if (!(await confirm({ title: own ? t.withdraw : ky.common.delete, message: own ? t.withdrawConfirm : t.deleteConfirm, danger: true, confirmText: own ? t.withdraw : ky.common.delete }))) return;
    await run(async () => {
      await api.del(`/api/library/${x.id}`);
      await load();
    });
  };

  const addStarter = async () => {
    if (!(await confirm({ title: t.starter, message: t.starterConfirm, confirmText: t.starter }))) return;
    await run(async () => {
      const r = await api.post<{ added: number }>('/api/library/starter');
      toast(t.starterAdded(r.added));
      if (r.added) setTab('PENDING');
      else await load();
    });
  };

  const importFile = (file: File) =>
    run(async () => {
      const form = new FormData();
      form.append('file', file);
      const r = await api.upload<{ imported: number; duplicates: number; errors: { row: number; problem: string }[] }>('/api/library/import', form);
      toast(t.imported(r.imported, r.duplicates, r.errors.length), r.errors.length && !r.imported ? 'err' : 'ok');
      for (const e of r.errors.slice(0, 5)) toast(ky.admin.import.rowError(e.row, e.problem), 'err');
      await load();
    });

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'LIBRARY', label: `📚 ${t.tabLibrary}` },
    ...(isAdmin ? [{ key: 'PENDING' as Tab, label: `⏳ ${t.tabPending}`, badge: data?.pendingCount }] : [{ key: 'MINE' as Tab, label: `✍️ ${t.tabMine}` }]),
  ];
  const chip = (on: boolean) => `rounded-full px-3 py-1 font-semibold transition ${on ? 'bg-ordo-night text-white' : 'bg-white ring-1 ring-ordo-gold/30 hover:bg-ordo-gold/10'}`;
  const emptyText = tab === 'PENDING' ? t.emptyPending : tab === 'MINE' ? t.emptyMine : q || category || difficulty || type ? t.empty : isAdmin ? t.emptyLibraryAdmin : t.emptyLibrary;

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="font-display text-2xl font-black">📚 {t.title}</h1>
          <p className="mt-1 text-ordo-ink/60">{t.subtitle}</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon="🌱" onClick={addStarter} disabled={busy}>
              {t.starter}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = ''; // ошол эле файлды кайра тандоого болушу үчүн
                if (file) void importFile(file);
              }}
            />
            <Button variant="outline" icon="📥" title={t.importHint} onClick={() => fileRef.current?.click()} disabled={busy}>
              {t.importExcel}
            </Button>
            <Button variant="red" icon="＋" onClick={() => setDraft({ ...emptyDraft('ROUND1') })}>
              {t.add}
            </Button>
          </div>
        )}
      </div>

      {/* Өтмөктөр */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((x) => (
          <button
            key={x.key}
            onClick={() => setTab(x.key)}
            className={`relative rounded-2xl border-2 px-4 py-2.5 font-semibold transition ${tab === x.key ? 'border-ordo-red bg-white shadow-lg' : 'border-transparent bg-white/60 hover:bg-white'}`}
          >
            {x.label}
            {!!x.badge && <span className="ml-2 rounded-full bg-ordo-red px-2 py-0.5 text-xs font-bold text-white">{x.badge}</span>}
          </button>
        ))}
      </div>

      {tab === 'PENDING' && <div className="rounded-2xl bg-ordo-gold/15 p-4 text-ordo-ink/80">ℹ️ {t.pendingHint}</div>}

      {/* Чыпкалар */}
      <div className="card space-y-3 p-4">
        <input className="input" type="search" placeholder={t.search} value={search} onChange={(e) => setSearch(e.target.value)} />
        {data && data.categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-ordo-ink/50">{ky.admin.questions.filterCategory}</span>
            <button onClick={() => setCategory('')} className={chip(!category)}>
              {ky.common.all}
            </button>
            {data.categories.map((c) => (
              <button key={c.name} onClick={() => setCategory(c.name)} className={chip(category === c.name)}>
                {c.name} <span className="opacity-60">{c.count}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-ordo-ink/50">{ky.admin.questions.filterDifficulty}</span>
          {(['', ...DIFFICULTIES] as (Difficulty | '')[]).map((d) => (
            <button key={d || 'all'} onClick={() => setDifficulty(d)} className={chip(difficulty === d)}>
              {d ? ky.difficulty[d] : ky.common.all}
            </button>
          ))}
          <span className="ml-2 h-5 w-px bg-ordo-ink/15" />
          {(['', ...QUESTION_TYPES] as (QuestionType | '')[]).map((x) => (
            <button key={x || 'all'} onClick={() => setType(x)} className={chip(type === x)}>
              {x ? ky.qtypesShort[x] : t.allTypes}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-10 w-10 text-ordo-red" />
        </div>
      ) : data.items.length === 0 ? (
        <div className="card p-10 text-center text-ordo-ink/60">{emptyText}</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold text-ordo-ink/60">{t.total(data.total)}</span>
            {selectable.length > 0 && (
              <button
                className="font-semibold text-ordo-sky hover:underline"
                onClick={() => setSelected(selected.size === selectable.length ? new Set() : new Set(selectable.map((x) => x.id)))}
              >
                {selected.size === selectable.length ? t.clearSelection : t.selectAll}
              </button>
            )}
          </div>

          <div className="space-y-2">
            {data.items.map((x) => {
              const sel = canSelect(x);
              const on = selected.has(x.id);
              return (
                <div
                  key={x.id}
                  onClick={() => sel && toggle(x.id)}
                  className={`card flex items-start gap-3 p-4 transition ${sel ? 'cursor-pointer hover:ring-2 hover:ring-ordo-gold/50' : ''} ${on ? 'ring-2 ring-ordo-sky' : ''} ${inBank.has(x.id) && tab === 'LIBRARY' ? 'opacity-70' : ''}`}
                >
                  {sel && (
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 text-sm font-black ${on ? 'border-ordo-sky bg-ordo-sky text-white' : 'border-ordo-ink/25 bg-white'}`}>
                      {on ? '✓' : ''}
                    </span>
                  )}
                  {x.imageUrl && <img src={assetUrl(x.imageUrl)} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <QuestionBadges q={x} />
                      {tab === 'MINE' && (
                        <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${x.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                          {x.status === 'PENDING' ? t.statusPending : t.statusApproved}
                        </span>
                      )}
                      {tab === 'LIBRARY' && inBank.has(x.id) && <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">{t.inBank}</span>}
                    </div>
                    <div className="mt-1 font-semibold">{x.text}</div>
                    <OptionsPreview q={x} />
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ordo-ink/45">
                      <span>{x.authorName ? t.author(x.authorName) : t.starterAuthor}</span>
                      {x.copiedCount > 0 && <span>{t.copiedTimes(x.copiedCount)}</span>}
                    </div>
                  </div>
                  {(isAdmin || (tab === 'MINE' && x.status === 'PENDING')) && (
                    <div className="flex shrink-0 flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                      {isAdmin && (
                        <Button size="sm" variant="outline" onClick={() => setDraft({ ...emptyDraft('ROUND1'), ...x, round: 'ROUND1' })}>
                          ✏️ {ky.common.edit}
                        </Button>
                      )}
                      <Button size="sm" variant="danger" onClick={() => remove(x)}>
                        🗑 {isAdmin ? ky.common.delete : t.withdraw}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {data.items.length < data.total && (
            <div className="flex justify-center">
              <Button variant="outline" loading={loadingMore} onClick={loadMore}>
                {t.loadMore} ({data.total - data.items.length})
              </Button>
            </div>
          )}
        </>
      )}

      {/* Тандалгандар менен аракеттер — ылдыйда туруктуу тилке */}
      {selected.size > 0 && (
        <div className="sticky bottom-3 z-30">
          <div className="bg-night flex flex-wrap items-center gap-3 rounded-2xl p-3 text-white shadow-2xl ring-1 ring-white/10">
            <span className="px-2 font-semibold">{t.selected(selected.size)}</span>
            {tab === 'LIBRARY' ? (
              <>
                <div className="flex flex-wrap items-center gap-1.5 text-sm" title={t.roundAutoHint}>
                  <span className="text-white/60">{t.roundLabel}</span>
                  {(['AUTO', ...ROUND_KEYS] as RoundChoice[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRound(r)}
                      className={`rounded-full px-3 py-1 font-semibold ${round === r ? 'bg-ordo-gold text-ordo-night' : 'bg-white/10 hover:bg-white/20'}`}
                    >
                      {r === 'AUTO' ? t.roundAuto : ky.rounds[r]}
                    </button>
                  ))}
                </div>
                <div className="flex-1" />
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/questions')}>
                  {t.goToBank}
                </Button>
                <Button variant="green" loading={busy} onClick={copy}>
                  {t.copy(selected.size)}
                </Button>
              </>
            ) : (
              <>
                <div className="flex-1" />
                <Button variant="danger" size="sm" disabled={busy} onClick={reject}>
                  {t.reject(selected.size)}
                </Button>
                <Button variant="green" loading={busy} onClick={approve}>
                  {t.approve(selected.size)}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <QuestionForm
        draft={draft}
        library
        categories={(data?.categories ?? []).map((c) => c.name)}
        onClose={() => setDraft(null)}
        onSaved={() => {
          setDraft(null);
          void load();
        }}
      />
    </div>
  );
}
