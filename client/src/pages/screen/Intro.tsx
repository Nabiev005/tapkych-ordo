import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { HornMotif, Logo, OrnamentBand } from '../../components/Ornament';
import { ky } from '../../i18n/ky';
import { assetUrl } from '../../lib/api';
import { sfx } from '../../lib/sound';
import type { ScreenState } from '../../lib/types';

/** Анимациялык интронун узактыгы (мс) */
const ANIMATION_MS = 9000;
/** Экран кечирээк ачылса (же жаңыланса) видео ушундан кийин көрсөтүлбөйт */
const VIDEO_WINDOW_MS = 3 * 60 * 1000;

/**
 * Оюн башталганда (1-тур, биринчи суроого чейин) экранда интро.
 * Алып баруучу «Биринчи суроо» баскычын басса — интро ошол замат токтойт.
 */
export default function IntroOverlay({ state, offset }: { state: ScreenState; offset: number }) {
  const g = state.game;
  const active = !!g.intro && !!g.startedAt && g.status === 'ROUND1' && g.phase === 'IDLE' && g.index === -1;
  const [doneFor, setDoneFor] = useState<number | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  if (!active || doneFor === g.startedAt) return null;

  const elapsed = Date.now() + offset - g.startedAt!;
  const video = g.intro!.videoUrl && !videoFailed ? assetUrl(g.intro!.videoUrl) : null;
  if (elapsed > (video ? VIDEO_WINDOW_MS : ANIMATION_MS)) return null;
  const done = () => setDoneFor(g.startedAt);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-30 bg-black">
      {video ? <IntroVideo src={video} elapsedMs={elapsed} onEnd={done} onError={() => setVideoFailed(true)} /> : <IntroAnimation title={g.title} onEnd={done} />}
    </motion.div>
  );
}

function IntroVideo({ src, elapsedMs, onEnd, onError }: { src: string; elapsedMs: number; onEnd: () => void; onError: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // Үн менен ойнотууга аракет; браузер уруксат бербесе — үнсүз
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(onError);
    });
  }, [src]);
  return (
    <video
      ref={ref}
      src={src}
      playsInline
      preload="auto"
      className="h-full w-full object-contain"
      onLoadedMetadata={(e) => {
        // Экран жаңыланса — видео ошол жеринен уланат
        const sec = elapsedMs / 1000;
        if (sec > 1 && sec < e.currentTarget.duration) e.currentTarget.currentTime = sec;
        else if (sec >= e.currentTarget.duration) onEnd();
      }}
      onEnded={onEnd}
      onError={onError}
    />
  );
}

function IntroAnimation({ title, onEnd }: { title: string | null; onEnd: () => void }) {
  useEffect(() => {
    sfx.intro();
    const t = setTimeout(onEnd, ANIMATION_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="bg-night relative flex h-full flex-col items-center justify-center overflow-hidden text-white">
      {/* Жарык нурлар */}
      <motion.div
        className="pointer-events-none absolute h-[160vmax] w-[160vmax] rounded-full"
        style={{ background: 'conic-gradient(from 0deg, transparent, rgba(245,183,0,0.10), transparent 20%, rgba(27,164,227,0.08), transparent 45%, rgba(245,183,0,0.10), transparent 70%)' }}
        initial={{ rotate: 0, opacity: 0 }}
        animate={{ rotate: 90, opacity: 1 }}
        transition={{ duration: 9, ease: 'linear' }}
      />
      <motion.div className="absolute inset-x-0 top-0" initial={{ x: '-100%' }} animate={{ x: 0 }} transition={{ delay: 2.2, duration: 1.2, ease: 'easeOut' }}>
        <OrnamentBand height={34} />
      </motion.div>
      <motion.div className="absolute inset-x-0 bottom-0" initial={{ x: '100%' }} animate={{ x: 0 }} transition={{ delay: 2.2, duration: 1.2, ease: 'easeOut' }}>
        <OrnamentBand height={34} flip />
      </motion.div>

      {/* 1-көрүнүш: логотип (түндүгү менен) жана оюндун аталышы */}
      <motion.div
        className="relative flex flex-col items-center gap-[5vh]"
        initial={{ opacity: 1 }}
        animate={{ opacity: [1, 1, 0], scale: [1, 1, 0.9] }}
        transition={{ duration: 5.4, times: [0, 0.88, 1] }}
      >
        <motion.div
          initial={{ scale: 0.2, rotate: -120, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ duration: 1.8, type: 'spring', damping: 14 }}
          className="drop-shadow-[0_0_60px_rgba(245,183,0,0.45)]"
        >
          <Logo size="xl" />
        </motion.div>
        {title && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 2.2, type: 'spring', damping: 12 }}
            className="rounded-full bg-gradient-to-b from-ordo-red to-ordo-red-dark px-12 py-4 text-center font-display text-[clamp(1.8rem,3.4vw,3.8rem)] font-black shadow-[0_0_60px_rgba(200,16,46,0.5)] ring-4 ring-ordo-gold/60"
          >
            {title}
          </motion.div>
        )}
      </motion.div>

      {/* 2-көрүнүш: «Оюн башталат!» */}
      <motion.div
        className="absolute flex items-center gap-8"
        initial={{ opacity: 0, scale: 2.5 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [2.5, 1, 1.05, 1.2] }}
        transition={{ delay: 5.2, duration: 3.8, times: [0, 0.15, 0.88, 1] }}
      >
        <HornMotif className="w-[8vw] text-ordo-gold" />
        <div className="whitespace-nowrap font-display text-[clamp(3rem,7vw,8rem)] font-black leading-none text-gold-gradient drop-shadow-[0_8px_40px_rgba(245,183,0,0.5)]">
          {ky.screen.introStarts}
        </div>
        <HornMotif className="w-[8vw] -scale-x-100 text-ordo-gold" />
      </motion.div>
    </div>
  );
}
