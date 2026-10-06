import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OPTION_STYLE } from '../../components/game';
import { Button, Modal, Spinner, useDialogs } from '../../components/ui';
import { fmtDate, ky, type Difficulty, type OptionKey, type QuestionType, type RoundKey } from '../../i18n/ky';
import { api, assetUrl, downloadFile } from '../../lib/api';
import { resizeImage } from '../../lib/image';
import { answerText } from '../../lib/questions';
import { DIFFICULTIES, OPTION_KEYS, QUESTION_TYPES, ROUND_KEYS, optionKeysFor, type Question } from '../../lib/types';

const REQUIRED: Record<RoundKey, number> = { ROUND1: 10, ROUND2: 10, FINAL: 5 };

type Draft = Omit<Question, 'id' | 'order' | 'archived' | 'usedCount' | 'lastUsedAt'> & { id?: number };
const emptyDraft = (round: RoundKey): Draft => ({
  round,
  type: 'CHOICE',
  category: '',
  difficulty: 'MEDIUM',
  text: '',
  imageUrl: null,
  audioUrl: null,
  optionA: '',
  optionB: '',
  optionC: '',
  optionD: '',
  correct: 'A',
});
const optField = (k: OptionKey) => `option${k}` as const;

const DIFF_STYLE: Record<Difficulty, string> = {
  EASY: 'bg-emerald-100 text-emerald-800',
  MEDIUM: 'bg-amber-100 text-amber-800',
  HARD: 'bg-rose-100 text-rose-800',
};

export function QuestionBadges({ q }: { q: Pick<Question, 'type' | 'category' | 'difficulty' | 'audioUrl' | 'imageUrl'> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${DIFF_STYLE[q.difficulty]}`}>{ky.difficulty[q.difficulty]}</span>
      {q.type !== 'CHOICE' && <span className="rounded-md bg-ordo-sky/15 px-2 py-0.5 text-xs font-bold text-ordo-sky">{ky.qtypesShort[q.type]}</span>}
      {q.category && <span className="rounded-md bg-ordo-ink/5 px-2 py-0.5 text-xs font-semibold text-ordo-ink/70">#{q.category}</span>}
      {q.audioUrl && <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">🎵</span>}
    </div>
  );
}

export default function Questions() {
  const navigate = useNavigate();
  const { confirm, toast } = useDialogs();
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [tab, setTab] = useState<RoundKey | 'ARCHIVE'>('ROUND1');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [cat, setCat] = useState('');
  const [diff, setDiff] = useState<Difficulty | ''>('');

  const load = () =>
    api
      .get<{ questions: Question[] }>('/api/questions')
      .then((r) => setQuestions(r.questions))
      .catch((e) => toast(e.message, 'err'));
  useEffect(() => {
    void load();
  }, []);

  const categories = useMemo(() => [...new Set((questions ?? []).map((q) => q.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ky')), [questions]);

  const byRound = useMemo(() => {
    const m: Record<RoundKey, Question[]> = { ROUND1: [], ROUND2: [], FINAL: [] };
    for (const q of questions ?? []) if (!q.archived) m[q.round].push(q);
    for (const r of ROUND_KEYS) m[r].sort((a, b) => a.order - b.order);
    return m;
  }, [questions]);

  const archived = useMemo(
    () => (questions ?? []).filter((q) => q.archived).sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '')),
    [questions],
  );
  const filtering = !!cat || !!diff;
  const matches = (q: Question) => (!cat || q.category === cat) && (!diff || q.difficulty === diff);
  const fullList = tab === 'ARCHIVE' ? [] : byRound[tab];
  const list = fullList.filter(matches);
  const roundTab: RoundKey = tab === 'ARCHIVE' ? 'ROUND1' : tab;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id || filtering) return;
    const oldI = list.findIndex((q) => q.id === e.active.id);
    const newI = list.findIndex((q) => q.id === e.over!.id);
    const moved = arrayMove(list, oldI, newI).map((q, i) => ({ ...q, order: i }));
    setQuestions((qs) => [...(qs ?? []).filter((q) => q.archived || q.round !== tab), ...moved]);
    try {
      await api.put('/api/questions/reorder', { round: tab, ids: moved.map((q) => q.id) });
      toast(ky.admin.questions.reordered);
    } catch (err) {
      toast((err as Error).message, 'err');
      void load();
    }
  };

  const remove = async (q: Question) => {
    if (!(await confirm({ title: ky.admin.questions.deleteConfirm, message: q.text, danger: true, confirmText: ky.common.delete }))) return;
    try {
      await api.del(`/api/questions/${q.id}`);
      toast(ky.admin.questions.deleted);
      void load();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  };

  const toArchive = async (q: Question) => {
    try {
      await api.post(`/api/questions/${q.id}/archive`);
      toast(ky.admin.questions.archived);
      void load();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-black">{ky.admin.questions.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            icon="📊"
            title={ky.admin.questions.exportHint}
            onClick={() => downloadFile('/api/questions/export.xlsx', ky.files.bank).catch((e) => toast(e.message, 'err'))}
          >
            {ky.admin.questions.exportBank}
          </Button>
          <Button variant="outline" icon="📥" onClick={() => navigate('/admin/import')}>
            {ky.admin.questions.import}
          </Button>
          <Button variant="red" icon="＋" onClick={() => setDraft(emptyDraft(roundTab))}>
            {ky.admin.questions.add}
          </Button>
        </div>
      </div>

      {/* Турлар боюнча өтмөктөр + саны текшерүү */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROUND_KEYS.map((r) => {
          const n = byRound[r].length;
          const ok = n >= REQUIRED[r];
          const active = tab === r;
          return (
            <button
              key={r}
              onClick={() => setTab(r)}
              className={`rounded-2xl border-2 p-4 text-left transition ${active ? 'border-ordo-red bg-white shadow-lg' : 'border-transparent bg-white/60 hover:bg-white'}`}
            >
              <div className="font-display text-lg font-bold">{ky.rounds[r]}</div>
              <div className={`mt-1 text-sm font-semibold ${ok ? 'text-emerald-600' : 'text-ordo-red'}`}>
                {ok ? ky.admin.questions.countOk(r, n) : ky.admin.questions.countLow(r, n, REQUIRED[r])}
              </div>
            </button>
          );
        })}
        <button
          onClick={() => setTab('ARCHIVE')}
          className={`rounded-2xl border-2 p-4 text-left transition ${tab === 'ARCHIVE' ? 'border-ordo-night bg-white shadow-lg' : 'border-transparent bg-white/60 hover:bg-white'}`}
        >
          <div className="font-display text-lg font-bold">🗄 {ky.admin.questions.archiveTab}</div>
          <div className="mt-1 text-sm font-semibold text-ordo-ink/50">{archived.length}</div>
        </button>
      </div>

      {/* Тема жана кыйынчылык боюнча чыпкалар */}
      {(categories.length > 0 || (questions ?? []).length > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-ordo-ink/50">{ky.admin.questions.filterCategory}</span>
          {['', ...categories].map((c) => (
            <button
              key={c || 'all'}
              onClick={() => setCat(c)}
              className={`rounded-full px-3 py-1 font-semibold ${cat === c ? 'bg-ordo-night text-white' : 'bg-white ring-1 ring-ordo-gold/30 hover:bg-ordo-gold/10'}`}
            >
              {c || ky.common.all}
            </button>
          ))}
          <span className="ml-3 font-semibold text-ordo-ink/50">{ky.admin.questions.filterDifficulty}</span>
          {(['', ...DIFFICULTIES] as (Difficulty | '')[]).map((d) => (
            <button
              key={d || 'all'}
              onClick={() => setDiff(d)}
              className={`rounded-full px-3 py-1 font-semibold ${diff === d ? 'bg-ordo-night text-white' : 'bg-white ring-1 ring-ordo-gold/30 hover:bg-ordo-gold/10'}`}
            >
              {d ? ky.difficulty[d] : ky.common.all}
            </button>
          ))}
        </div>
      )}

      {tab === 'ARCHIVE' ? (
        <ArchiveList list={archived.filter(matches)} onChanged={load} onEdit={(q) => setDraft({ ...q })} onDelete={remove} />
      ) : (
        <>
          <div className="text-sm text-ordo-ink/50">
            {!filtering && `${ky.admin.questions.dragHint}. `}
            {tab === 'FINAL' ? ky.admin.questions.finalNote : ky.admin.questions.onlyFirst(REQUIRED[tab])}
          </div>

          {!questions ? (
            <Spinner />
          ) : list.length === 0 ? (
            <div className="card p-10 text-center text-ordo-ink/60">{ky.admin.questions.empty}</div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={list.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {list.map((q) => (
                    <SortableRow
                      key={q.id}
                      q={q}
                      index={fullList.indexOf(q)}
                      dragDisabled={filtering}
                      onEdit={() => setDraft({ ...q })}
                      onDelete={() => remove(q)}
                      onArchive={() => toArchive(q)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </>
      )}

      <QuestionForm
        draft={draft}
        categories={categories}
        onClose={() => setDraft(null)}
        onSaved={(round) => {
          setDraft(null);
          if (tab !== 'ARCHIVE') setTab(round);
          void load();
        }}
      />
    </div>
  );
}

function OptionsPreview({ q }: { q: Question }) {
  if (q.type === 'ORDER') {
    return (
      <ol className="mt-2 space-y-1 text-sm">
        {[...q.correct].map((l, i) => (
          <li key={l} className="flex items-center gap-2 rounded-lg bg-emerald-50 px-2 py-1 text-emerald-900">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">{i + 1}</span>
            {q[optField(l as OptionKey)]}
          </li>
        ))}
      </ol>
    );
  }
  return (
    <div className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
      {optionKeysFor(q.type).map((k) => (
        <div key={k} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${q.correct === k ? 'bg-emerald-100 font-semibold text-emerald-800' : 'text-ordo-ink/70'}`}>
          <span className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-white ${OPTION_STYLE[k].bg}`}>{ky.options[k]}</span>
          <span className="truncate">{q[optField(k)]}</span>
          {q.correct === k && <span className="ml-auto">✓</span>}
        </div>
      ))}
    </div>
  );
}

function SortableRow({
  q,
  index,
  dragDisabled,
  onEdit,
  onDelete,
  onArchive,
}: {
  q: Question;
  index: number;
  dragDisabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id, disabled: dragDisabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`card flex items-start gap-3 p-4 ${isDragging ? 'z-10 shadow-2xl ring-2 ring-ordo-sky' : ''}`}
    >
      {!dragDisabled && (
        <button className="cursor-grab touch-none rounded-lg px-2 py-1 text-2xl text-ordo-ink/30 hover:bg-ordo-gold/15 active:cursor-grabbing" {...attributes} {...listeners}>
          ⠿
        </button>
      )}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ordo-night font-display font-bold text-ordo-gold">{index + 1}</div>
      {q.imageUrl && <img src={assetUrl(q.imageUrl)} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />}
      <div className="min-w-0 flex-1">
        <QuestionBadges q={q} />
        <div className="mt-1 font-semibold">{q.text}</div>
        <OptionsPreview q={q} />
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <Button size="sm" variant="outline" onClick={onEdit}>
          ✏️ {ky.common.edit}
        </Button>
        <Button size="sm" variant="outline" onClick={onArchive}>
          🗄 {ky.admin.questions.toArchive}
        </Button>
        <Button size="sm" variant="danger" onClick={onDelete}>
          🗑 {ky.common.delete}
        </Button>
      </div>
    </div>
  );
}

function QuestionForm({ draft, categories, onClose, onSaved }: { draft: Draft | null; categories: string[]; onClose: () => void; onSaved: (r: RoundKey) => void }) {
  const { toast } = useDialogs();
  const [d, setD] = useState<Draft | null>(draft);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<'image' | 'audio' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  useEffect(() => setD(draft), [draft]);

  const f = ky.admin.questions.form;
  const orderDone = d?.type === 'ORDER' && d.correct.length === 4;
  const valid =
    !!d &&
    !!d.text.trim() &&
    (d.type === 'TF' || OPTION_KEYS.every((k) => d[optField(k)].trim())) &&
    (d.type !== 'ORDER' || orderDone);

  const setType = (type: QuestionType) => {
    if (!d) return;
    // Түрү өзгөргөндө туура жоопту ошого ылайыкташтырабыз
    const correct = type === 'ORDER' ? '' : type === 'TF' ? (d.correct === 'B' ? 'B' : 'A') : 'ABCD'.includes(d.correct) && d.correct.length === 1 ? d.correct : 'A';
    setD({ ...d, type, correct });
  };

  const upload = async (file: File, kind: 'image' | 'audio') => {
    setUploading(kind);
    try {
      let toSend = file;
      if (kind === 'image') {
        const r = await resizeImage(file);
        toSend = r.file;
        if (r.resized) toast(f.imageResized);
      }
      const form = new FormData();
      form.append(kind, toSend);
      const { url } = await api.upload<{ url: string }>(`/api/uploads/${kind}`, form);
      setD((x) => (x ? { ...x, [kind === 'image' ? 'imageUrl' : 'audioUrl']: url } : x));
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (!d || !valid) return toast(d?.type === 'ORDER' && !orderDone ? f.missingOrder : f.missing, 'err');
    setBusy(true);
    const body = {
      round: d.round,
      type: d.type,
      category: d.category,
      difficulty: d.difficulty,
      text: d.text,
      imageUrl: d.imageUrl,
      audioUrl: d.audioUrl,
      optionA: d.optionA,
      optionB: d.optionB,
      optionC: d.optionC,
      optionD: d.optionD,
      correct: d.correct,
    };
    try {
      if (d.id) await api.put(`/api/questions/${d.id}`, body);
      else await api.post('/api/questions', body);
      toast(ky.common.saved);
      onSaved(d.round);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const seg = (on: boolean) => `rounded-2xl border-2 px-3 py-2.5 font-semibold transition ${on ? 'border-ordo-red bg-ordo-red text-white' : 'border-ordo-gold/30 bg-white hover:border-ordo-gold'}`;

  return (
    <Modal open={!!draft} onClose={onClose} title={d?.id ? f.editTitle : f.newTitle} wide>
      {d && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">{f.round}</label>
              <div className="grid grid-cols-3 gap-2">
                {ROUND_KEYS.map((r) => (
                  <button key={r} onClick={() => setD({ ...d, round: r })} className={seg(d.round === r)}>
                    {ky.rounds[r]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">{f.difficulty}</label>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTIES.map((x) => (
                  <button key={x} onClick={() => setD({ ...d, difficulty: x })} className={seg(d.difficulty === x)}>
                    {ky.difficulty[x]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">{f.type}</label>
              <div className="grid gap-2">
                {QUESTION_TYPES.map((x) => (
                  <button key={x} onClick={() => setType(x)} className={`${seg(d.type === x)} text-left text-sm`}>
                    {ky.qtypes[x]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">{f.category}</label>
              <input className="input" list="question-categories" placeholder={f.categoryPlaceholder} value={d.category} maxLength={40} onChange={(e) => setD({ ...d, category: e.target.value })} />
              <datalist id="question-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <div className="mt-2 flex flex-wrap gap-1">
                {categories.slice(0, 10).map((c) => (
                  <button key={c} onClick={() => setD({ ...d, category: c })} className="rounded-full bg-ordo-ink/5 px-2.5 py-0.5 text-xs font-semibold hover:bg-ordo-gold/20">
                    #{c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="label">{f.text}</label>
            <textarea className="input min-h-24 resize-y" placeholder={f.textPlaceholder} value={d.text} onChange={(e) => setD({ ...d, text: e.target.value })} autoFocus />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">{f.image}</label>
              <div className="flex flex-wrap items-center gap-2">
                {d.imageUrl && <img src={assetUrl(d.imageUrl)} alt="" className="h-16 w-24 rounded-xl object-cover ring-2 ring-ordo-gold/30" />}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], 'image')} />
                <Button variant="outline" size="sm" loading={uploading === 'image'} onClick={() => fileRef.current?.click()}>
                  🖼 {uploading === 'image' ? f.uploading : f.uploadImage}
                </Button>
                {d.imageUrl && (
                  <Button variant="ghost" size="sm" onClick={() => setD({ ...d, imageUrl: null })}>
                    ✕
                  </Button>
                )}
              </div>
            </div>
            <div>
              <label className="label">{f.audio}</label>
              <div className="flex flex-wrap items-center gap-2">
                <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], 'audio')} />
                <Button variant="outline" size="sm" loading={uploading === 'audio'} onClick={() => audioRef.current?.click()}>
                  🎵 {uploading === 'audio' ? f.uploading : f.uploadAudio}
                </Button>
                {d.audioUrl && (
                  <Button variant="ghost" size="sm" onClick={() => setD({ ...d, audioUrl: null })}>
                    ✕ {f.removeAudio}
                  </Button>
                )}
              </div>
              {d.audioUrl && <audio controls src={assetUrl(d.audioUrl)} className="mt-2 w-full" />}
            </div>
          </div>

          {/* Варианттар — түрүнө жараша */}
          {d.type === 'TF' && (
            <div>
              <label className="label">{f.tfCorrect}</label>
              <div className="grid grid-cols-2 gap-3">
                {(['A', 'B'] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setD({ ...d, correct: k })}
                    className={`rounded-2xl border-4 py-5 font-display text-2xl font-black transition ${d.correct === k ? 'border-emerald-600 bg-emerald-100 text-emerald-800' : 'border-ordo-gold/20 bg-white text-ordo-ink/60'}`}
                  >
                    {d.correct === k ? '✓ ' : ''}
                    {ky.tf[k]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {d.type === 'CHOICE' && (
            <div>
              <label className="label">
                {f.options} — <span className="text-emerald-700">{f.correctHint}</span>
              </label>
              <div className="space-y-2">
                {OPTION_KEYS.map((k) => {
                  const isCorrect = d.correct === k;
                  return (
                    <div key={k} className={`flex items-center gap-2 rounded-2xl p-1.5 transition ${isCorrect ? 'bg-emerald-100 ring-2 ring-emerald-500' : ''}`}>
                      <button
                        type="button"
                        title={f.correct}
                        onClick={() => setD({ ...d, correct: k })}
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-display text-xl font-black text-white transition ${isCorrect ? 'bg-emerald-600' : OPTION_STYLE[k].bg + ' opacity-80 hover:opacity-100'}`}
                      >
                        {isCorrect ? '✓' : ky.options[k]}
                      </button>
                      <input className="input" placeholder={f.optionPlaceholder(ky.options[k])} value={d[optField(k)]} onChange={(e) => setD({ ...d, [optField(k)]: e.target.value })} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {d.type === 'ORDER' && (
            <div className="space-y-3">
              <label className="label">{f.orderItems}</label>
              <div className="space-y-2">
                {OPTION_KEYS.map((k) => {
                  const pos = d.correct.indexOf(k);
                  return (
                    <div key={k} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => pos < 0 && d.correct.length < 4 && setD({ ...d, correct: d.correct + k })}
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-display text-xl font-black text-white ${pos >= 0 ? 'bg-emerald-600' : OPTION_STYLE[k].bg}`}
                        title={f.orderHint}
                      >
                        {pos >= 0 ? pos + 1 : ky.options[k]}
                      </button>
                      <input className="input" placeholder={f.optionPlaceholder(ky.options[k])} value={d[optField(k)]} onChange={(e) => setD({ ...d, [optField(k)]: e.target.value })} />
                    </div>
                  );
                })}
              </div>
              <div className="rounded-2xl bg-ordo-sky/10 p-3 text-sm">
                <div className="font-semibold">{f.orderHint}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-ordo-ink/60">{f.orderCurrent}</span>
                  <span className="font-bold text-emerald-800">{d.correct ? answerText('ORDER', d.correct, { A: d.optionA, B: d.optionB, C: d.optionC, D: d.optionD }) : '—'}</span>
                  {d.correct && (
                    <button className="ml-auto rounded-lg px-2 py-0.5 font-semibold text-ordo-red hover:bg-ordo-red/10" onClick={() => setD({ ...d, correct: '' })}>
                      ↺ {f.orderReset}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button variant="outline" size="lg" onClick={onClose}>
              {ky.common.cancel}
            </Button>
            <Button variant="green" size="lg" loading={busy} disabled={!valid} onClick={save}>
              {busy ? ky.common.saving : ky.common.save}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Архив: мурунку оюндарда суралган суроолор — кайра банкка кайтарса болот */
function ArchiveList({ list, onChanged, onEdit, onDelete }: { list: Question[]; onChanged: () => void; onEdit: (q: Question) => void; onDelete: (q: Question) => void }) {
  const t = ky.admin.questions;
  const { confirm, toast } = useDialogs();
  const [round, setRound] = useState<RoundKey | ''>('');
  const shown = list.filter((q) => !round || q.round === round);

  const restore = async (ids?: number[]) => {
    try {
      const r = await api.post<{ restored: number }>('/api/questions/restore', ids ? { ids } : round ? { round } : {});
      toast(t.restored(r.restored));
      onChanged();
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-ordo-sky/10 p-4 text-ordo-ink/80">ℹ️ {t.archiveHint}</div>
      <div className="flex flex-wrap items-center gap-2">
        {(['', ...ROUND_KEYS] as (RoundKey | '')[]).map((r) => (
          <button
            key={r || 'all'}
            onClick={() => setRound(r)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${round === r ? 'bg-ordo-night text-white' : 'bg-white ring-1 ring-ordo-gold/30'}`}
          >
            {r ? ky.rounds[r] : t.filterAll} ({(r ? list.filter((q) => q.round === r) : list).length})
          </button>
        ))}
        <div className="flex-1" />
        {shown.length > 0 && (
          <Button
            variant="green"
            size="sm"
            onClick={async () => {
              if (await confirm({ title: t.restoreAll, message: t.restoreAllConfirm(shown.length), confirmText: t.restoreAll }))
                await restore(shown.map((q) => q.id));
            }}
          >
            ↩ {t.restoreAll}
          </Button>
        )}
      </div>
      {shown.length === 0 ? (
        <div className="card p-10 text-center text-ordo-ink/60">{t.archiveEmpty}</div>
      ) : (
        <div className="space-y-2">
          {shown.map((q) => (
            <div key={q.id} className="card flex items-start gap-3 p-4 opacity-90">
              <span className="shrink-0 rounded-lg bg-ordo-ink/5 px-2 py-1 text-xs font-bold text-ordo-ink/60">{ky.rounds[q.round]}</span>
              <div className="min-w-0 flex-1">
                <QuestionBadges q={q} />
                <div className="mt-1 font-semibold">{q.text}</div>
                <div className="mt-1 text-sm text-emerald-700">✓ {answerText(q.type, q.correct, { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD })}</div>
                {q.lastUsedAt && <div className="mt-1 text-xs text-ordo-ink/45">{t.usedInfo(q.usedCount, fmtDate(q.lastUsedAt))}</div>}
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <Button size="sm" variant="green" onClick={() => restore([q.id])}>
                  ↩ {t.restore}
                </Button>
                <Button size="sm" variant="outline" onClick={() => onEdit(q)}>
                  ✏️ {ky.common.edit}
                </Button>
                <Button size="sm" variant="danger" onClick={() => onDelete(q)}>
                  🗑 {ky.common.delete}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
