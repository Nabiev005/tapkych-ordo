import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CornerOrnament, HornMotif, SunTunduk } from '../components/Ornament';
import { Button, Spinner } from '../components/ui';
import { fmtDate, ky } from '../i18n/ky';
import { api } from '../lib/api';
import type { RatingRow, Season } from '../lib/types';

/**
 * Грамоталар: ?season=ID&top=3 же ?student=ID&season=ID.
 * Браузердин «Басып чыгаруу → PDF катары сактоо» аркылуу PDF алынат (альбомдук барак).
 */
export default function Certificate() {
  const t = ky.certificate;
  const [params] = useSearchParams();
  const seasonId = params.get('season');
  const studentId = Number(params.get('student')) || null;
  const top = Math.min(10, Number(params.get('top')) || 3);
  const [rows, setRows] = useState<(RatingRow & { place: number })[] | null>(null);
  const [season, setSeason] = useState<Season | null>(null);

  useEffect(() => {
    const q = seasonId ? `?seasonId=${seasonId}` : '';
    api.get<{ rows: RatingRow[] }>(`/api/rating${q}`).then((r) => {
      const ranked = r.rows.map((row, i) => ({ ...row, place: i + 1 }));
      setRows(studentId ? ranked.filter((x) => x.studentId === studentId) : ranked.slice(0, top));
    });
    if (seasonId) api.get<{ seasons: Season[] }>('/api/seasons').then((r) => setSeason(r.seasons.find((s) => String(s.id) === seasonId) ?? null));
  }, [seasonId, studentId, top]);

  if (!rows)
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-10 w-10 text-ordo-red" />
      </div>
    );

  const when = season ? t.seasonOf(season.name) : t.allTime;

  return (
    <div className="min-h-dvh bg-slate-200 py-6 print:bg-white print:py-0">
      <style>{'@page { size: A4 landscape; margin: 0 } @media print { .cert { page-break-after: always; box-shadow: none !important; margin: 0 !important } }'}</style>
      <div className="no-print mx-auto mb-6 flex max-w-[297mm] flex-wrap items-center justify-between gap-3 px-4">
        <p className="max-w-2xl text-sm text-ordo-ink/70">{t.printHint}</p>
        <Button size="lg" icon="🖨" onClick={() => window.print()}>
          {t.print}
        </Button>
      </div>
      {rows.map((r) => (
        <div
          key={r.studentId}
          className="cert relative mx-auto mb-8 flex h-[210mm] w-[297mm] flex-col items-center overflow-hidden bg-[#fffaf0] px-[22mm] py-[16mm] text-center shadow-2xl"
        >
          {/* Оюу-оймо алкагы */}
          <div className="pointer-events-none absolute inset-[7mm] rounded-[6mm] border-[3px] border-ordo-red" />
          <div className="pointer-events-none absolute inset-[10mm] rounded-[4mm] border border-ordo-gold" />
          <CornerOrnament className="absolute left-[9mm] top-[9mm] h-[30mm] w-[30mm]" color="#c8102e" />
          <CornerOrnament className="absolute right-[9mm] top-[9mm] h-[30mm] w-[30mm] -scale-x-100" color="#c8102e" />
          <CornerOrnament className="absolute bottom-[9mm] left-[9mm] h-[30mm] w-[30mm] -scale-y-100" color="#c8102e" />
          <CornerOrnament className="absolute bottom-[9mm] right-[9mm] h-[30mm] w-[30mm] -scale-100" color="#c8102e" />

          <SunTunduk size={88} spin={false} />
          <div className="mt-1 font-display text-lg font-bold tracking-[0.4em] text-ordo-red">{ky.appNameUpper}</div>
          <div className="mt-3 flex items-center gap-4">
            <HornMotif className="w-16 text-ordo-gold" />
            <div className="font-display text-[22mm] font-black leading-none text-ordo-red">{t.title}</div>
            <HornMotif className="w-16 -scale-x-100 text-ordo-gold" />
          </div>
          <div className="mt-4 text-xl text-ordo-ink/60">{t.awarded}</div>
          <div className="mt-1 font-display text-[13mm] font-black leading-tight text-ordo-ink">{r.name}</div>
          {r.className && <div className="text-xl font-semibold text-ordo-ink/60">{r.className}</div>}
          <div className="mt-4 rounded-full bg-gradient-to-r from-ordo-gold-light to-ordo-gold px-10 py-2 font-display text-3xl font-black text-ordo-ink">
            {r.place <= 3 ? ['🥇', '🥈', '🥉'][r.place - 1] + ' ' : ''}
            {t.placeText(r.place)}
          </div>
          <p className="mt-4 max-w-[200mm] text-xl leading-relaxed text-ordo-ink/80">{t.reason(when)}</p>
          <p className="mt-2 text-base text-ordo-ink/55">{t.stats(r.totalScore, r.wins, r.accuracy)}</p>

          <div className="mt-auto mb-[4mm] grid w-full grid-cols-3 items-end gap-10 px-[16mm] text-left text-base text-ordo-ink/70">
            <div>
              <div className="border-b border-ordo-ink/40 pb-6" />
              <div className="mt-1">{t.director}</div>
            </div>
            <div className="text-center">
              {t.date}: <b>{fmtDate(new Date())}</b>
            </div>
            <div>
              <div className="border-b border-ordo-ink/40 pb-6" />
              <div className="mt-1">{t.organizer}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
