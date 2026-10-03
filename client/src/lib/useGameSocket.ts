import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE, ApiError } from './api';

export type ConnStatus = 'connecting' | 'online' | 'offline' | 'denied';

type AckRes = { ok: true } | { ok: false; error: string; details?: unknown };

/**
 * Socket.IO туташуусу: автоматтык түрдө кайра туташат, сервер менен саатты шайкештейт.
 * Сервер ар бир туташууда толук абалды жөнөтөт, ошондуктан баракча жаңыланса да эч нерсе жоголбойт.
 */
export function useGameSocket<S extends { serverNow: number }>(
  auth: Record<string, unknown> | null,
  handlers: Record<string, () => void> = {},
) {
  const [state, setState] = useState<S | null>(null);
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [offset, setOffset] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const authKey = auth ? JSON.stringify(auth) : null;

  useEffect(() => {
    if (!authKey) return;
    const opts = { auth: JSON.parse(authKey), transports: ['websocket', 'polling'] };
    const socket = API_BASE ? io(API_BASE, opts) : io(opts);
    socketRef.current = socket;
    setStatus('connecting');

    const sync = () => {
      // Бир нече жолу өлчөп, эң тез жооп келгенин алабыз
      let best = Infinity;
      let samples = 0;
      const once = () => {
        const t0 = Date.now();
        socket.emit('time:sync', (serverNow: number) => {
          const t1 = Date.now();
          const rtt = t1 - t0;
          if (rtt < best) {
            best = rtt;
            setOffset(serverNow + rtt / 2 - t1);
          }
          if (++samples < 5) setTimeout(once, 150);
        });
      };
      once();
    };

    socket.on('connect', () => {
      setStatus('online');
      sync();
    });
    socket.on('disconnect', () => setStatus('offline'));
    socket.on('connect_error', (err) => {
      if (err.message === 'UNAUTHORIZED') {
        setStatus('denied');
        socket.disconnect();
      } else setStatus('offline');
    });
    socket.on('state', (s: S) => setState(s));
    for (const ev of ['game:deleted', 'player:kicked', 'session:replaced']) {
      socket.on(ev, () => handlersRef.current[ev]?.());
    }
    const resync = setInterval(sync, 60_000);
    return () => {
      clearInterval(resync);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authKey]);

  const emit = useCallback((event: string, payload: unknown): Promise<void> => {
    return new Promise((resolve, reject) => {
      const s = socketRef.current;
      if (!s || !s.connected) return reject(new ApiError('NETWORK'));
      const timer = setTimeout(() => reject(new ApiError('NETWORK')), 8000);
      s.emit(event, payload, (res: AckRes) => {
        clearTimeout(timer);
        if (res.ok) resolve();
        else reject(new ApiError(res.error, res.details));
      });
    });
  }, []);

  return { state, status, offset, emit };
}

/** Сервердин убактысы боюнча калган миллисекунд (100 мс сайын жаңыланат) */
export function useCountdown(endsAt: number | null, offset: number, pausedRemainingMs: number | null = null) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now() + offset), 100);
    setNow(Date.now() + offset);
    return () => clearInterval(id);
  }, [endsAt, offset]);
  if (pausedRemainingMs !== null && !endsAt) return pausedRemainingMs;
  if (!endsAt) return 0;
  return Math.max(0, endsAt - now);
}
