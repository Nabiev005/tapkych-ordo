import { useEffect, useMemo, useRef, useState } from 'react';
import { PackIcon, PACK_ICON_MAP } from '../../components/PackIcon';
import type { LucideIcon } from 'lucide-react';
import { Download, Gift, Hourglass, Import, Info, Library as LibraryIcon, PenLine, Pencil, Sprout, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal, Spinner, useDialogs } from '../../components/ui';
import { ky, type Difficulty, type QuestionType, type RoundKey } from '../../i18n/ky';
import { api, assetUrl, staffUser } from '../../lib/api';
import { DIFFICULTIES, QUESTION_TYPES, ROUND_KEYS, type LibraryItem, type LibraryPackInfo } from '../../lib/types';
import { OptionsPreview, QuestionBadges, QuestionForm, emptyDraft, type Draft } from './Questions';

type Tab = 'LIBRARY' | 'PACKS' | 'PENDING' | 'MINE';
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
  const [packItems, setPackItems] = useState<LibraryItem[] | null>(null);
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
    if (tab === 'PACKS') return;
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
      const r = await api.post<{ added: number; packs: number }>('/api/library/starter');
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

  const tabs: { key: Tab; label: string; icon: LucideIcon; badge?: number }[] = [
    { key: 'LIBRARY', label: t.tabLibrary, icon: LibraryIcon },
    { key: 'PACKS', label: t.tabPacks, icon: Gift },
    ...(isAdmin ? [{ key: 'PENDING' as Tab, label: t.tabPending, icon: Hourglass, badge: data?.pendingCount }] : [{ key: 'MINE' as Tab, label: t.tabMine, icon: PenLine }]),
  ];
  const chip = (on: boolean) => `rounded-full px-3 py-1 font-semibold transition ${on ? 'bg-ordo-night text-white' : 'bg-white ring-1 ring-ordo-gold/30 hover:bg-ordo-gold/10'}`;
  const emptyText = tab === 'PENDING' ? t.emptyPending : tab === 'MINE' ? t.emptyMine : q || category || difficulty || type ? t.empty : isAdmin ? t.emptyLibraryAdmin : t.emptyLibrary;

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="font-display text-2xl font-black"><LibraryIcon className="ico text-ordo-red" /> {t.title}</h1>
          <p className="mt-1 text-ordo-ink/60">{t.subtitle}</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<Sprout />} onClick={addStarter} disabled={busy}>
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
            <Button variant="outline" icon={<Import />} title={t.importHint} onClick={() => fileRef.current?.click()} disabled={busy}>
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
            <x.icon className="ico" /> {x.label}
            {!!x.badge && <span className="ml-2 rounded-full bg-ordo-red px-2 py-0.5 text-xs font-bold text-white">{x.badge}</span>}
          </button>
        ))}
      </div>

      {tab === 'PENDING' && <div className="rounded-2xl bg-ordo-gold/15 p-4 text-ordo-ink/80"><Info className="ico" /> {t.pendingHint}</div>}

      {tab === 'PACKS' ? (
        <Packs isAdmin={isAdmin} />
      ) : (
        <>
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
                              <Pencil className="ico" /> {ky.common.edit}
                            </Button>
                          )}
                          <Button size="sm" variant="danger" onClick={() => remove(x)}>
                            <Trash2 className="ico" /> {isAdmin ? ky.common.delete : t.withdraw}
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
        </>
      )}

      {/* Тандалгандар менен аракеттер — ылдыйда туруктуу тилке */}
      {selected.size > 0 && tab !== 'PACKS' && (
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
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={() => setPackItems((data?.items ?? []).filter((x) => selected.has(x.id)))}>
                    <Gift className="ico" /> {t.createPack(selected.size)}
                  </Button>
                )}
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

      <PackModal
        items={packItems}
        onClose={() => setPackItems(null)}
        onCreated={() => {
          setPackItems(null);
          setSelected(new Set());
          setTab('PACKS');
        }}
      />

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

const PACK_ICONS = Object.keys(PACK_ICON_MAP);
const AUTO_ROUND: Record<Difficulty, RoundKey> = { EASY: 'ROUND1', MEDIUM: 'ROUND2', HARD: 'FINAL' };

/** Даяр оюн пакеттери: бир басуу менен бүтүндөй оюнга керектүү суроолор банкка кошулат */
function Packs({ isAdmin }: { isAdmin: boolean }) {
  const t = ky.admin.library;
  const navigate = useNavigate();
  const { confirm, toast } = useDialogs();
  const [packs, setPacks] = useState<LibraryPackInfo[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = () =>
    api
      .get<{ packs: LibraryPackInfo[] }>('/api/library/packs')
      .then((r) => setPacks(r.packs))
      .catch((e) => toast(e.message, 'err'));
  useEffect(() => {
    void load();
  }, []);

  const copy = async (p: LibraryPackInfo) => {
    setBusy(p.id);
    try {
      const r = await api.post<{ copied: number; skipped: number }>(`/api/library/packs/${p.id}/copy`);
      toast(t.packCopied(r.copied, r.skipped));
      await load();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (p: LibraryPackInfo) => {
    if (!(await confirm({ title: ky.common.delete, message: t.packDeleteConfirm(p.title), danger: true, confirmText: ky.common.delete }))) return;
    await api.del(`/api/library/packs/${p.id}`).catch((e) => toast(e.message, 'err'));
    void load();
  };

  if (!packs)
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-10 w-10 text-ordo-red" />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-ordo-sky/10 p-4 text-ordo-ink/80"><Info className="ico" /> {t.packsHint}</div>
      {packs.length === 0 ? (
        <div className="card p-10 text-center text-ordo-ink/60">{isAdmin ? t.packsEmptyAdmin : t.packsEmpty}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {packs.map((p) => {
            const full = p.total > 0 && p.inBank >= p.total;
            return (
              <div key={p.id} className="card flex flex-col gap-3 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ordo-night text-ordo-gold">
                    <PackIcon name={p.icon} className="h-7 w-7" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-lg leading-tight font-bold">{p.title}</h3>
                    <div className="text-sm text-ordo-ink/50">{t.packTotal(p.total)}</div>
                  </div>
                  {isAdmin && (
                    <button title={ky.common.delete} className="rounded-lg p-1.5 text-ordo-ink/40 hover:bg-ordo-red/10 hover:text-ordo-red" onClick={() => remove(p)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {p.description && <p className="text-sm text-ordo-ink/70">{p.description}</p>}
                <div className="flex flex-wrap gap-1.5 text-xs font-bold">
                  {ROUND_KEYS.map((r) => (
                    <span key={r} className="rounded-md bg-ordo-ink/5 px-2 py-1">
                      {ky.rounds[r]}: {p.counts[r]}
                    </span>
                  ))}
                </div>
                {p.pending > 0 && <div className="text-xs font-semibold text-amber-700"><Hourglass className="ico" /> {t.packPending(p.pending)}</div>}
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                  {p.inBank > 0 && <span className="text-xs font-semibold text-emerald-700">✓ {t.packInBank(p.inBank, p.total)}</span>}
                  <div className="flex-1" />
                  {full ? (
                    <Button size="sm" variant="red" onClick={() => navigate('/admin/games/new')}>
                      {t.newGame}
                    </Button>
                  ) : (
                    <Button size="sm" variant="green" loading={busy === p.id} disabled={!p.total} onClick={() => copy(p)}>
                      <Download className="ico" /> {t.packCopy}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Тандалган китепкана суроолорунан пакет түзүү (башкы алып баруучу) */
function PackModal({ items, onClose, onCreated }: { items: LibraryItem[] | null; onClose: () => void; onCreated: () => void }) {
  const t = ky.admin.library;
  const { toast } = useDialogs();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState(PACK_ICONS[0]);
  const [rounds, setRounds] = useState<Record<number, RoundKey>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!items) return;
    setTitle('');
    setDescription('');
    setIcon(PACK_ICONS[0]);
    setRounds(Object.fromEntries(items.map((x) => [x.id, AUTO_ROUND[x.difficulty]])));
  }, [items]);

  const save = async () => {
    if (!items) return;
    setBusy(true);
    try {
      await api.post('/api/library/packs', { title, description, icon, items: items.map((x) => ({ id: x.id, round: rounds[x.id] })) });
      toast(t.packCreated);
      onCreated();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const counts = ROUND_KEYS.map((r) => `${ky.rounds[r]}: ${Object.values(rounds).filter((x) => x === r).length}`).join(' · ');

  return (
    <Modal open={!!items} onClose={onClose} title={t.createPack(items?.length ?? 0)} wide>
      {items && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <label className="label">{t.packTitle}</label>
              <input className="input" maxLength={80} placeholder={t.packTitlePlaceholder} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">{t.packIcon}</label>
              <div className="flex max-w-xs flex-wrap gap-1">
                {PACK_ICONS.map((i) => (
                  <button key={i} onClick={() => setIcon(i)} className={`flex h-9 w-9 items-center justify-center rounded-lg ${icon === i ? 'bg-ordo-gold/40 ring-2 ring-ordo-gold' : 'hover:bg-ordo-gold/15'}`}>
                    <PackIcon name={i} className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="label">{t.packDesc}</label>
            <input className="input" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="label">
              {t.packRounds} <span className="font-normal text-ordo-ink/50">({counts})</span>
            </label>
            <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {items.map((x) => (
                <div key={x.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2 ring-1 ring-ordo-gold/20">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={x.text}>
                    {x.text}
                  </span>
                  <div className="flex gap-1">
                    {ROUND_KEYS.map((r) => (
                      <button
                        key={r}
                        onClick={() => setRounds((s) => ({ ...s, [x.id]: r }))}
                        className={`rounded-lg px-2 py-1 text-xs font-bold ${rounds[x.id] === r ? 'bg-ordo-red text-white' : 'bg-ordo-ink/5 hover:bg-ordo-gold/20'}`}
                      >
                        {ky.rounds[r]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" size="lg" onClick={onClose}>
              {ky.common.cancel}
            </Button>
            <Button variant="green" size="lg" loading={busy} disabled={!title.trim()} onClick={save}>
              {t.packSave}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
