import { Download, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fmtDate, ky } from '../i18n/ky';
import { Button, Modal, Spinner, useDialogs } from './ui';
import { SUN_CX, SUN_CY, SUN_DISC_R, SUN_PATH, SUN_R } from './flagSun';

/**
 * Соц. тармактар үчүн жеңүүчүлөрдүн карточкасы (PNG) — браузерде canvas менен тартылат.
 * Пост (1080×1350) же сторис (1080×1920). me берилсе — оюнчунун өз орду ылдыйда көрсөтүлөт.
 */
export interface ShareCardData {
  code: string;
  title: string | null;
  date: number | null;
  players: number;
  podium: { name: string; total: number }[];
  championTeam?: { team: string; total: number } | null;
  me?: { name: string; place: number; total: number } | null;
}

type Format = 'post' | 'story';
const SIZE: Record<Format, [number, number]> = { post: [1080, 1350], story: [1080, 1920] };

const GOLD = '#f5b700';
const GOLD_LIGHT = '#fff3b0';
const RED = '#c8102e';
const DISPLAY = '"Montserrat Variable", Montserrat, sans-serif';
const BODY = '"Inter Variable", Inter, sans-serif';

/** Текстти туурасына батыра кичирейтет (эң кичине — min) */
function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxWidth: number, family = DISPLAY, min = 22) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && s > min) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

/** Атты эки сапка бөлөт (сөз боюнча), ар бир сап туурасына батат */
function nameLines(ctx: CanvasRenderingContext2D, name: string, maxWidth: number, size: number): [string[], number] {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [[name], fitFont(ctx, name, 900, size, maxWidth)];
  const mid = Math.ceil(words.length / 2);
  const lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
  const s = Math.min(...lines.map((l) => fitFont(ctx, l, 900, size, maxWidth)));
  return [lines, s];
}

/** Күн-түндүк: алтын нурлар, кызыл тегерек жана түндүктүн тилкелери */
function drawSun(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  // Туудагы күндүн расмий формасы: кызыл диск түндүктүн сызыктарын кызыл кылат
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(r / SUN_R, r / SUN_R);
  ctx.translate(-SUN_CX, -SUN_CY);
  ctx.beginPath();
  ctx.arc(SUN_CX, SUN_CY, SUN_DISC_R - 0.4, 0, Math.PI * 2);
  ctx.fillStyle = RED;
  ctx.fill();
  ctx.fillStyle = GOLD;
  ctx.fill(new Path2D(SUN_PATH), 'evenodd');
  ctx.restore();
}

/** Оюу тилкеси: кайталанган алтын ромбдор жана мүйүз сымал ийриктер */
function drawBand(ctx: CanvasRenderingContext2D, y: number, w: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(245,183,0,0.12)';
  ctx.fillRect(0, y, w, 44);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, y + 2);
  ctx.lineTo(w, y + 2);
  ctx.moveTo(0, y + 42);
  ctx.lineTo(w, y + 42);
  ctx.stroke();
  for (let x = 30; x < w; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, y + 10);
    ctx.lineTo(x + 12, y + 22);
    ctx.lineTo(x, y + 34);
    ctx.lineTo(x - 12, y + 22);
    ctx.closePath();
    ctx.fillStyle = GOLD;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 30, y + 22, 7, Math.PI * 0.2, Math.PI * 1.8);
    ctx.stroke();
  }
  ctx.restore();
}

export async function drawShareCard(canvas: HTMLCanvasElement, d: ShareCardData, format: Format) {
  const t = ky.shareCard;
  const [W, H] = SIZE[format];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  // Ариптер жүктөлмөйүнчө тартпайбыз (антпесе башка арип менен чыгат)
  await Promise.all([document.fonts.load(`900 64px ${DISPLAY}`), document.fonts.load(`600 32px ${BODY}`)]).catch(() => undefined);

  // Фон: караңгы көк → кочкул кызыл, жумшак жарыктар
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#071226');
  bg.addColorStop(0.55, '#0b1d3a');
  bg.addColorStop(1, '#3a0b18');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  for (const [x, y, r, c] of [
    [W * 0.15, H * 0.2, 520, 'rgba(27,164,227,0.18)'],
    [W * 0.9, H * 0.95, 620, 'rgba(200,16,46,0.30)'],
    [W * 0.5, H * 0.42, 460, 'rgba(245,183,0,0.10)'],
  ] as [number, number, number, string][]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  drawBand(ctx, 0, W);
  drawBand(ctx, H - 44, W);

  const story = format === 'story';
  let y = story ? 230 : 150;
  drawSun(ctx, W / 2, y, story ? 105 : 85);
  y += story ? 165 : 130;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = GOLD;
  ctx.font = `800 34px ${DISPLAY}`;
  ctx.fillText(ky.appNameUpper.split('').join(' '), W / 2, y);
  y += story ? 120 : 100;

  // ЖЕҢҮҮЧҮЛӨР — алтын градиент
  const tg = ctx.createLinearGradient(0, y - 90, 0, y);
  tg.addColorStop(0, GOLD_LIGHT);
  tg.addColorStop(0.5, GOLD);
  tg.addColorStop(1, '#b8860b');
  ctx.fillStyle = tg;
  fitFont(ctx, t.winners, 900, story ? 112 : 100, W - 120);
  ctx.fillText(t.winners, W / 2, y);
  y += story ? 70 : 60;

  ctx.fillStyle = '#ffffff';
  fitFont(ctx, d.title || t.untitled, 700, 46, W - 160);
  ctx.fillText(d.title || t.untitled, W / 2, y);
  y += 48;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `600 30px ${BODY}`;
  ctx.fillText([d.date ? fmtDate(new Date(d.date)) : '', d.players ? t.players(d.players) : ''].filter(Boolean).join(' · '), W / 2, y);

  if (d.championTeam) {
    y += 70;
    ctx.fillStyle = '#7fd3f7';
    fitFont(ctx, t.champion(d.championTeam.team), 800, 40, W - 160);
    ctx.fillText(t.champion(d.championTeam.team), W / 2, y);
  }

  // Пьедестал: 2-орун сол жакта, 1-орун ортодо, 3-орун оң жакта.
  // Бийиктиги аталыштан ылдый калган орунга жараша: таажы (~90) + эки саптуу ат (~140) + аралык батышы керек
  const footerH = d.me ? 330 : 190;
  const baseY = H - footerH;
  const colW = 300;
  const gap = 30;
  const h1 = Math.min(story ? 740 : 400, baseY - y - 270);
  const heights = [h1, Math.round(h1 * 0.75), Math.round(h1 * 0.58)];
  const colors: [string, string][] = [
    [GOLD_LIGHT, '#c99500'],
    ['#f1f5f9', '#64748b'],
    ['#fed7aa', '#c2410c'],
  ];
  [1, 0, 2].forEach((idx, col) => {
    const p = d.podium[idx];
    const x = W / 2 + (col - 1) * (colW + gap) - colW / 2;
    const h = heights[idx];
    const top = baseY - h;
    if (!p) return;
    const g = ctx.createLinearGradient(0, top, 0, baseY);
    g.addColorStop(0, colors[idx][0]);
    g.addColorStop(1, colors[idx][1]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x, top, colW, h, [28, 28, 0, 0]);
    ctx.fill();
    // Орун (мамыча жапыз болсо — сан кичирээк)
    const numSize = Math.min(idx === 0 ? 150 : 120, h * 0.55);
    const numY = top + numSize * 1.05;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `900 ${numSize}px ${DISPLAY}`;
    ctx.fillText(String(idx + 1), x + colW / 2, numY);
    // Упай
    ctx.fillStyle = 'rgba(7,18,38,0.75)';
    ctx.font = `800 34px ${DISPLAY}`;
    ctx.fillText(t.points(p.total), x + colW / 2, numY + 52);
    // Аты (пьедесталдын үстүндө, 1–2 сап)
    const [lines, size] = nameLines(ctx, p.name, colW + 10, idx === 0 ? 50 : 42);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${size}px ${DISPLAY}`;
    lines.forEach((l, i) => ctx.fillText(l, x + colW / 2, top - 24 - (lines.length - 1 - i) * (size + 8)));
    // Таажы 1-орунга
    if (idx === 0) {
      const cy = top - 40 - lines.length * (size + 8) - 20;
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.moveTo(x + colW / 2 - 60, cy);
      ctx.lineTo(x + colW / 2 - 60, cy - 50);
      ctx.lineTo(x + colW / 2 - 30, cy - 20);
      ctx.lineTo(x + colW / 2, cy - 62);
      ctx.lineTo(x + colW / 2 + 30, cy - 20);
      ctx.lineTo(x + colW / 2 + 60, cy - 50);
      ctx.lineTo(x + colW / 2 + 60, cy);
      ctx.closePath();
      ctx.fill();
    }
  });

  // Оюнчунун өз орду
  let fy = baseY + 70;
  if (d.me) {
    const bx = 90;
    ctx.fillStyle = 'rgba(245,183,0,0.16)';
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(bx, baseY + 30, W - bx * 2, 120, 28);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    const line = `${d.me.name} — ${t.me(d.me.place)} · ${t.points(d.me.total)}`;
    fitFont(ctx, line, 800, 44, W - bx * 2 - 60);
    ctx.fillText(line, W / 2, baseY + 105);
    fy = baseY + 210;
  }

  // Төмөнкү бөлүк
  ctx.fillStyle = GOLD;
  ctx.font = `900 46px ${DISPLAY}`;
  ctx.fillText('www.tapkych.com', W / 2, fy);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `600 28px ${BODY}`;
  ctx.fillText(t.footer, W / 2, fy + 44);
}

const toBlob = (canvas: HTMLCanvasElement) => new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));

/** Карточканы алдын ала көрүү, жүктөп алуу жана бөлүшүү терезеси */
export function ShareCardModal({ open, onClose, data }: { open: boolean; onClose: () => void; data: ShareCardData }) {
  const t = ky.shareCard;
  const { toast } = useDialogs();
  const [format, setFormat] = useState<Format>('post');
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let made: string | null = null;
    setUrl(null);
    const canvas = document.createElement('canvas');
    drawShareCard(canvas, data, format)
      .then(() => toBlob(canvas))
      .then((b) => {
        if (cancelled || !b) return;
        made = URL.createObjectURL(b);
        setBlob(b);
        setUrl(made);
      })
      .catch((e) => toast((e as Error).message, 'err'));
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
    // data ар бир рендерде жаңы объект болушу мүмкүн — мазмуну өзгөргөндө гана кайра тартабыз
  }, [open, format, JSON.stringify(data)]);

  const file = blob ? new File([blob], t.file(data.code), { type: 'image/png' }) : null;
  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

  const download = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = t.file(data.code);
    a.click();
  };

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: ky.appName, text: 'www.tapkych.com' });
    } catch {
      /* колдонуучу жокко чыгарды */
    }
  };

  const seg = (on: boolean) => `rounded-xl px-4 py-2 text-sm font-bold transition ${on ? 'bg-ordo-night text-white' : 'bg-white ring-1 ring-ordo-gold/30 hover:bg-ordo-gold/10'}`;

  return (
    <Modal open={open} onClose={onClose} title={t.title}>
      <div className="space-y-4">
        <p className="text-sm text-ordo-ink/60">{t.hint}</p>
        <div className="flex gap-2">
          <button className={seg(format === 'post')} onClick={() => setFormat('post')}>
            {t.post}
          </button>
          <button className={seg(format === 'story')} onClick={() => setFormat('story')}>
            {t.story}
          </button>
        </div>
        <div className="flex min-h-64 items-center justify-center rounded-2xl bg-ordo-ink/5 p-3">
          {url ? <img src={url} alt="" className={`rounded-xl shadow-xl ${format === 'story' ? 'max-h-[60vh]' : 'max-h-[55vh]'}`} /> : <Spinner className="h-10 w-10 text-ordo-red" />}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {canShare && (
            <Button variant="sky" icon={<Share2 />} onClick={share}>
              {t.share}
            </Button>
          )}
          <Button variant="green" icon={<Download />} disabled={!url} onClick={download}>
            {t.download}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
