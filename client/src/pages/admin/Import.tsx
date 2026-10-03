import { motion } from 'framer-motion';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Spinner, useDialogs } from '../../components/ui';
import { ky, type RoundKey } from '../../i18n/ky';
import { api, downloadFile } from '../../lib/api';
import { ROUND_KEYS } from '../../lib/types';

interface Preview {
  dryRun: boolean;
  valid: number;
  imported?: number;
  counts: Record<RoundKey, number>;
  errors: { row: number; problem: string }[];
  preview?: { round: RoundKey; text: string; correct: string }[];
}

export default function ImportPage() {
  const t = ky.admin.import;
  const navigate = useNavigate();
  const { toast, confirm } = useDialogs();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [replace, setReplace] = useState(false);
  const [drag, setDrag] = useState(false);

  const send = (f: File, query: string) => {
    const form = new FormData();
    form.append('file', f);
    return api.upload<Preview>(`/api/questions/import?${query}`, form);
  };

  const pick = async (f: File) => {
    setFile(f);
    setPreview(null);
    setChecking(true);
    try {
      setPreview(await send(f, 'dryRun=1'));
    } catch (e) {
      toast((e as Error).message, 'err');
      setFile(null);
    } finally {
      setChecking(false);
    }
  };

  const doImport = async () => {
    if (!file || !preview) return;
    if (replace && !(await confirm({ title: t.modeReplace, message: t.replaceWarn, danger: true, confirmText: ky.common.confirm }))) return;
    setImporting(true);
    try {
      const r = await send(file, `force=1${replace ? '&replace=1' : ''}`);
      toast(t.done(r.imported ?? 0));
      navigate('/admin/questions');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setImporting(false);
    }
  };

  const dl = (path: string, name: string) => downloadFile(path, name).catch((e) => toast(e.message, 'err'));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate('/admin/questions')}>
          ← {ky.common.back}
        </Button>
        <h1 className="font-display text-2xl font-black">{t.title}</h1>
      </div>

      <section className="card space-y-3 p-6">
        <h2 className="font-display text-lg font-bold">{t.step1}</h2>
        <p className="text-ordo-ink/60">{t.step1Hint}</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="green" icon="📊" onClick={() => dl('/api/questions/template.xlsx', ky.files.templateXlsx)}>
            {t.templateXlsx}
          </Button>
          <Button variant="outline" icon="📄" onClick={() => dl('/api/questions/template.csv', ky.files.templateCsv)}>
            {t.templateCsv}
          </Button>
        </div>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="font-display text-lg font-bold">{t.step2}</h2>
        <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files[0]) void pick(e.dataTransfer.files[0]);
          }}
          className={`flex flex-col items-center gap-3 rounded-3xl border-4 border-dashed p-10 text-center transition ${drag ? 'border-ordo-sky bg-ordo-sky/10' : 'border-ordo-gold/40'}`}
        >
          <div className="text-5xl">📁</div>
          <Button variant="sky" size="lg" onClick={() => fileRef.current?.click()}>
            {t.chooseFile}
          </Button>
          <div className="text-ordo-ink/50">{file ? `📎 ${file.name}` : t.dropHint}</div>
          {checking && (
            <div className="flex items-center gap-2 text-ordo-sky">
              <Spinner /> {t.checking}
            </div>
          )}
        </div>
      </section>

      {preview && (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card space-y-4 p-6">
          <h2 className="font-display text-lg font-bold">{t.step3}</h2>
          <div className="text-2xl font-bold text-emerald-700">✓ {t.found(preview.valid)}</div>
          <div className="flex flex-wrap gap-2">
            {ROUND_KEYS.map((r) => (
              <span key={r} className="rounded-full bg-ordo-gold/20 px-4 py-1.5 font-semibold">
                {t.perRound(r, preview.counts[r] ?? 0)}
              </span>
            ))}
          </div>

          {preview.errors.length > 0 && (
            <div className="rounded-2xl bg-ordo-red/10 p-4">
              <div className="mb-2 font-bold text-ordo-red">⚠ {t.errorsTitle(preview.errors.length)}</div>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-ordo-red/90">
                {preview.errors.map((e) => (
                  <li key={e.row}>• {t.rowError(e.row, e.problem)}</li>
                ))}
              </ul>
            </div>
          )}

          {preview.preview && preview.preview.length > 0 && (
            <details className="rounded-2xl bg-ordo-cream p-4">
              <summary className="cursor-pointer font-semibold">{t.preview}</summary>
              <ol className="mt-2 max-h-60 list-decimal space-y-1 overflow-y-auto pl-6 text-sm">
                {preview.preview.map((q, i) => (
                  <li key={i}>
                    <span className="font-semibold text-ordo-red">{ky.rounds[q.round]}</span> — {q.text}
                  </li>
                ))}
              </ol>
            </details>
          )}

          <div className="space-y-2">
            {[false, true].map((v) => (
              <label key={String(v)} className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 ${replace === v ? (v ? 'border-ordo-red bg-ordo-red/5' : 'border-ordo-sky bg-ordo-sky/5') : 'border-ordo-gold/20'}`}>
                <input type="radio" className="h-5 w-5" checked={replace === v} onChange={() => setReplace(v)} />
                <span className="font-semibold">{v ? t.modeReplace : t.modeAppend}</span>
              </label>
            ))}
          </div>

          <Button size="lg" variant="green" className="w-full" loading={importing} disabled={preview.valid === 0} onClick={doImport}>
            {importing ? t.importing : t.doImport(preview.valid)}
          </Button>
        </motion.section>
      )}
    </div>
  );
}
