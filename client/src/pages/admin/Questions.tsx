import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OPTION_STYLE } from '../../components/game';
import { Button, Modal, Spinner, useDialogs } from '../../components/ui';
import { ky, type OptionKey, type RoundKey } from '../../i18n/ky';
import { api, assetUrl } from '../../lib/api';
import { OPTION_KEYS, ROUND_KEYS, type Question } from '../../lib/types';

const REQUIRED: Record<RoundKey, number> = { ROUND1: 10, ROUND2: 10, FINAL: 5 };

type Draft = Omit<Question, 'id' | 'order'> & { id?: number };
const emptyDraft = (round: RoundKey): Draft => ({
  round,
  text: '',
  imageUrl: null,
  optionA: '',
  optionB: '',
  optionC: '',
  optionD: '',
  correct: 'A',
});
const optField = (k: OptionKey) => `option${k}` as const;

export default function Questions() {
  const navigate = useNavigate();
  const { confirm, toast } = useDialogs();
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [tab, setTab] = useState<RoundKey>('ROUND1');
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = () =>
    api
      .get<{ questions: Question[] }>('/api/questions')
      .then((r) => setQuestions(r.questions))
      .catch((e) => toast(e.message, 'err'));
  useEffect(() => {
    void load();
  }, []);

  const byRound = useMemo(() => {
    const m: Record<RoundKey, Question[]> = { ROUND1: [], ROUND2: [], FINAL: [] };
    for (const q of questions ?? []) m[q.round].push(q);
    for (const r of ROUND_KEYS) m[r].sort((a, b) => a.order - b.order);
    return m;
  }, [questions]);

  const list = byRound[tab];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const oldI = list.findIndex((q) => q.id === e.active.id);
    const newI = list.findIndex((q) => q.id === e.over!.id);
    const moved = arrayMove(list, oldI, newI).map((q, i) => ({ ...q, order: i }));
    setQuestions((qs) => [...(qs ?? []).filter((q) => q.round !== tab), ...moved]);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-black">{ky.admin.questions.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" icon="📥" onClick={() => navigate('/admin/import')}>
            {ky.admin.questions.import}
          </Button>
          <Button variant="red" icon="＋" onClick={() => setDraft(emptyDraft(tab))}>
            {ky.admin.questions.add}
          </Button>
        </div>
      </div>

      {/* Турлар боюнча өтмөктөр + саны текшерүү */}
      <div className="grid gap-3 sm:grid-cols-3">
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
      </div>

      <div className="text-sm text-ordo-ink/50">
        {ky.admin.questions.dragHint}. {tab === 'FINAL' ? ky.admin.questions.finalNote : ky.admin.questions.onlyFirst(REQUIRED[tab])}
      </div>

      {!questions ? (
        <Spinner />
      ) : list.length === 0 ? (
        <div className="card p-10 text-center text-ordo-ink/60">{ky.admin.questions.empty}</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={list.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {list.map((q, i) => (
                <SortableRow key={q.id} q={q} index={i} onEdit={() => setDraft({ ...q })} onDelete={() => remove(q)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <QuestionForm
        draft={draft}
        onClose={() => setDraft(null)}
        onSaved={(round) => {
          setDraft(null);
          setTab(round);
          void load();
        }}
      />
    </div>
  );
}

function SortableRow({ q, index, onEdit, onDelete }: { q: Question; index: number; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`card flex items-start gap-3 p-4 ${isDragging ? 'z-10 shadow-2xl ring-2 ring-ordo-sky' : ''}`}
    >
      <button className="cursor-grab touch-none rounded-lg px-2 py-1 text-2xl text-ordo-ink/30 hover:bg-ordo-gold/15 active:cursor-grabbing" {...attributes} {...listeners}>
        ⠿
      </button>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ordo-night font-display font-bold text-ordo-gold">{index + 1}</div>
      {q.imageUrl && <img src={assetUrl(q.imageUrl)} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />}
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{q.text}</div>
        <div className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
          {OPTION_KEYS.map((k) => (
            <div key={k} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${q.correct === k ? 'bg-emerald-100 font-semibold text-emerald-800' : 'text-ordo-ink/70'}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-white ${OPTION_STYLE[k].bg}`}>{ky.options[k]}</span>
              <span className="truncate">{q[optField(k)]}</span>
              {q.correct === k && <span className="ml-auto">✓</span>}
            </div>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <Button size="sm" variant="outline" onClick={onEdit}>
          ✏️ {ky.common.edit}
        </Button>
        <Button size="sm" variant="danger" onClick={onDelete}>
          🗑 {ky.common.delete}
        </Button>
      </div>
    </div>
  );
}

function QuestionForm({ draft, onClose, onSaved }: { draft: Draft | null; onClose: () => void; onSaved: (r: RoundKey) => void }) {
  const { toast } = useDialogs();
  const [d, setD] = useState<Draft | null>(draft);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setD(draft), [draft]);

  const f = ky.admin.questions.form;
  const valid = !!d && !!d.text.trim() && OPTION_KEYS.every((k) => d[optField(k)].trim());

  const upload = async (file: File) => {
    const form = new FormData();
    form.append('image', file);
    setUploading(true);
    try {
      const { url } = await api.upload<{ url: string }>('/api/uploads/image', form);
      setD((x) => (x ? { ...x, imageUrl: url } : x));
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!d || !valid) return toast(f.missing, 'err');
    setBusy(true);
    const body = { round: d.round, text: d.text, imageUrl: d.imageUrl, optionA: d.optionA, optionB: d.optionB, optionC: d.optionC, optionD: d.optionD, correct: d.correct };
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

  return (
    <Modal open={!!draft} onClose={onClose} title={d?.id ? f.editTitle : f.newTitle} wide>
      {d && (
        <div className="space-y-5">
          <div>
            <label className="label">{f.round}</label>
            <div className="grid grid-cols-3 gap-2">
              {ROUND_KEYS.map((r) => (
                <button
                  key={r}
                  onClick={() => setD({ ...d, round: r })}
                  className={`rounded-2xl border-2 py-3 font-display font-bold transition ${d.round === r ? 'border-ordo-red bg-ordo-red text-white' : 'border-ordo-gold/30 bg-white hover:border-ordo-gold'}`}
                >
                  {ky.rounds[r]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">{f.text}</label>
            <textarea className="input min-h-24 resize-y" placeholder={f.textPlaceholder} value={d.text} onChange={(e) => setD({ ...d, text: e.target.value })} autoFocus />
          </div>

          <div>
            <label className="label">{f.image}</label>
            <div className="flex items-center gap-3">
              {d.imageUrl && <img src={assetUrl(d.imageUrl)} alt="" className="h-20 w-28 rounded-xl object-cover ring-2 ring-ordo-gold/30" />}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <Button variant="outline" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
                🖼 {uploading ? f.uploading : f.uploadImage}
              </Button>
              {d.imageUrl && (
                <Button variant="ghost" size="sm" onClick={() => setD({ ...d, imageUrl: null })}>
                  ✕ {f.removeImage}
                </Button>
              )}
            </div>
          </div>

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
                    <input
                      className="input"
                      placeholder={f.optionPlaceholder(ky.options[k])}
                      value={d[optField(k)]}
                      onChange={(e) => setD({ ...d, [optField(k)]: e.target.value })}
                    />
                  </div>
                );
              })}
            </div>
          </div>

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
