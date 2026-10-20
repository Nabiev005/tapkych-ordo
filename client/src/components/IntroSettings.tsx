import { Clapperboard, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { ky } from '../i18n/ky';
import { api, assetUrl } from '../lib/api';
import { Button, useDialogs } from './ui';

const MAX_BYTES = 25 * 1024 * 1024;
const TYPES = ['video/mp4', 'video/webm'];

/** Оюндун башталышындагы интро: күйгүзүү/өчүрүү жана өзүнүн видеосун жүктөө */
export default function IntroSettings({
  enabled,
  videoUrl,
  onChange,
}: {
  enabled: boolean;
  videoUrl: string | null;
  onChange: (patch: { introEnabled?: boolean; introVideoUrl?: string | null }) => void;
}) {
  const t = ky.admin.newGame;
  const { toast } = useDialogs();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (!TYPES.includes(file.type) || file.size > MAX_BYTES) return toast(t.introBadFile, 'err');
    setBusy(true);
    try {
      const form = new FormData();
      form.append('video', file);
      const { url } = await api.upload<{ url: string }>('/api/uploads/video', form);
      onChange({ introVideoUrl: url, introEnabled: true });
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-start gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onChange({ introEnabled: !enabled })}
          className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? 'left-6' : 'left-1'}`} />
        </button>
        <span>
          <span className="block text-sm font-semibold text-ordo-ink/80">{t.introEnabled}</span>
          <span className="block text-xs text-ordo-ink/50">{t.introHint}</span>
        </span>
      </label>
      {enabled && (
        <div className="rounded-2xl bg-ordo-cream p-3">
          <div className="mb-2 text-sm font-semibold text-ordo-ink/70">
            <Clapperboard className="ico" /> {t.introVideo}
          </div>
          {videoUrl ? (
            <>
              <video src={assetUrl(videoUrl)} controls muted className="mb-2 max-h-48 w-full rounded-xl bg-black" />
              <Button size="sm" variant="outline" icon={<Trash2 />} onClick={() => onChange({ introVideoUrl: null })}>
                {t.introRemove}
              </Button>
            </>
          ) : (
            <>
              <div className="mb-2 text-xs text-ordo-ink/50">{t.introDefault}</div>
              <Button size="sm" variant="sky" icon={<Upload />} loading={busy} onClick={() => input.current?.click()}>
                {t.introUpload}
              </Button>
            </>
          )}
          <input
            ref={input}
            type="file"
            accept="video/mp4,video/webm"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void upload(f);
            }}
          />
        </div>
      )}
    </div>
  );
}
