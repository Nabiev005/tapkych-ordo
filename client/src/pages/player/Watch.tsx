import { motion } from 'framer-motion';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AudienceBars, OPTION_STYLE } from '../../components/game';
import { Logo, OrnamentBand } from '../../components/Ornament';
import { ConnBadge, FullCenter, Spinner, useDialogs } from '../../components/ui';
import { ky } from '../../i18n/ky';
import { assetUrl } from '../../lib/api';
import { answerText } from '../../lib/questions';
import { vibrate } from '../../lib/sound';
import { optionKeysFor, type AudienceState } from '../../lib/types';
import { useCountdown, useGameSocket } from '../../lib/useGameSocket';

/** Түзмөк үчүн туруктуу аноним белги — бир суроого бир гана добуш */
function voterId(): string {
  const KEY = 'ordo_voter';
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return 'anon-' + Math.random().toString(36).slice(2, 12);
  }
}

/** Залдагы көрүүчү: PIN’сиз, суроого добуш берет (упайга таасир этпейт) */
export default function Watch() {
  const t = ky.audience;
  const { code = '' } = useParams();
  const [voter] = useState(voterId);
  const { toast } = useDialogs();
  const { state, status, offset, emit } = useGameSocket<AudienceState>({ role: 'audience', code, voterId: voter });
  const [pending, setPending] = useState<string | null>(null);
  const g = state?.game;
  const q = state?.question;
  const msLeft = useCountdown(g?.phase === 'QUESTION' ? (g?.endsAt ?? null) : null, offset, g?.pausedRemainingMs ?? null);

  if (status === 'denied')
    return (
      <FullCenter>
        <Logo size="md" />
        <p className="mt-6 text-xl text-white/70">{t.notFound}</p>
      </FullCenter>
    );
  if (!state || !g)
    return (
      <FullCenter>
        <Spinner className="h-12 w-12 text-ordo-gold" />
      </FullCenter>
    );

  const vote = async (choice: string) => {
    setPending(choice);
    vibrate(30);
    try {
      await emit('audience:vote', { choice });
    } catch (e) {
      setPending(null);
      toast((e as Error).message, 'err');
    }
  };
  const myVote = q?.myVote ?? pending;
  const showQuestion = q && (g.phase === 'QUESTION' || g.phase === 'REVEAL') && q.options;

  return (
    <div className="bg-night flex min-h-dvh flex-col text-white">
      <OrnamentBand height={16} />
      <div className="flex items-center justify-between px-4 pt-3">
        <Logo size="sm" />
        <span className="rounded-full bg-violet-600/40 px-3 py-1 text-sm font-semibold">👥 {t.title}</span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        {g.status === 'FINISHED' ? (
          <div className="flex flex-1 items-center justify-center text-center font-display text-2xl font-bold">{t.finished}</div>
        ) : !showQuestion ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2 }} className="font-display text-2xl font-bold">
              {t.waiting}
            </motion.div>
            <p className="max-w-xs text-white/60">{t.hint}</p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display font-bold text-white/70">
                {g.round && ky.rounds[g.round]} · {q!.number}/{g.total}
              </span>
              {g.phase === 'QUESTION' && <span className="font-display text-2xl font-black tabular-nums">{Math.ceil(msLeft / 1000)}</span>}
            </div>
            <div className="mb-4 rounded-3xl bg-white/[0.08] p-4 ring-1 ring-white/10">
              {q!.imageUrl && <img src={assetUrl(q!.imageUrl)} alt="" className="mb-3 max-h-40 w-full rounded-2xl object-contain" />}
              <div className="text-xl font-semibold">{q!.text}</div>
            </div>

            {g.phase === 'REVEAL' ? (
              <div className="flex flex-col items-center gap-4">
                <div className="rounded-2xl bg-emerald-600 px-5 py-3 text-center text-lg font-bold">
                  ✓ {t.correct}: {answerText(q!.type, q!.correct, q!.options)}
                </div>
                {q!.audience?.counts && q!.audience.total > 0 && (
                  <div className="rounded-3xl bg-white/5 p-4">
                    <div className="mb-2 text-center font-semibold text-violet-200">{t.results}</div>
                    <AudienceBars counts={q!.audience.counts} total={q!.audience.total} keys={optionKeysFor(q!.type)} correct={q!.correct} />
                  </div>
                )}
              </div>
            ) : q!.type === 'ORDER' ? (
              <div className="rounded-2xl bg-white/5 p-4 text-center text-white/70">{t.noVote}</div>
            ) : myVote ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <div className="text-6xl">✓</div>
                <div className="font-display text-xl font-bold">{t.voted}</div>
                <div className="text-white/70">{answerText(q!.type, myVote, q!.options)}</div>
              </div>
            ) : msLeft <= 0 ? (
              <div className="text-center text-white/70">{t.timeUp}</div>
            ) : (
              <div className="flex flex-col gap-3">
                {optionKeysFor(q!.type).map((k) => (
                  <motion.button
                    key={k}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => vote(k)}
                    className={`flex min-h-16 items-center gap-4 rounded-3xl px-4 py-3 text-left font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.35)] ${OPTION_STYLE[k].bg}`}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black/20 font-display text-2xl font-black">{ky.options[k]}</span>
                    <span className="text-lg">{q!.type === 'TF' ? ky.tf[k] : q!.options![k]}</span>
                  </motion.button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <OrnamentBand height={16} flip />
      <ConnBadge status={status} dark />
    </div>
  );
}
