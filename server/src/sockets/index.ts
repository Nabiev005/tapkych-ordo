import type { Server, Socket } from 'socket.io';
import { prisma } from '../db.js';
import { verifyAdminToken } from '../auth.js';
import { bus } from '../events.js';
import { AppError } from '../types.js';
import { presence } from '../game/presence.js';
import { loadFull } from '../game/load.js';
import { adminSnapshot, playerSnapshot, screenSnapshot } from '../game/state.js';
import { runAdminAction, submitAnswer, type AdminAction } from '../game/engine.js';

/**
 * Бөлмөлөр:
 *   game:<id>:admin    — алып баруучу
 *   game:<id>:screen   — жалпы экран(дар)
 *   game:<id>:players  — бардык оюнчулар
 *   player:<id>        — бир оюнчунун түзмөгү
 */
export const rooms = {
  admin: (g: number) => `game:${g}:admin`,
  screen: (g: number) => `game:${g}:screen`,
  players: (g: number) => `game:${g}:players`,
  player: (p: number) => `player:${p}`,
};

type SocketData =
  | { role: 'admin'; gameId: number }
  | { role: 'screen'; gameId: number }
  | { role: 'player'; gameId: number; playerId: number; token: string };

type Ack = (res: { ok: true } | { ok: false; error: string; details?: unknown }) => void;

let io: Server;

/** Оюндун абалын ар бир ролго өзүнчө жөнөтөт */
export async function broadcastState(gameId: number) {
  const game = await loadFull(gameId);
  if (!game) {
    io.to([rooms.admin(gameId), rooms.screen(gameId), rooms.players(gameId)]).emit('game:deleted');
    return;
  }
  io.to(rooms.admin(gameId)).emit('state', await adminSnapshot(game));
  io.to(rooms.screen(gameId)).emit('state', screenSnapshot(game));
  for (const p of game.players) {
    io.to(rooms.player(p.id)).emit('state', playerSnapshot(game, p.id));
  }
}

/** Бир эле учурда көп өзгөрүү болсо (мис. 12 оюнчу бир секундда жооп берсе), бир гана жолу жөнөтөбүз */
const pending = new Map<number, NodeJS.Timeout>();
function scheduleBroadcast(gameId: number) {
  if (pending.has(gameId)) return;
  pending.set(
    gameId,
    setTimeout(() => {
      pending.delete(gameId);
      broadcastState(gameId).catch((e) => console.error('broadcast', e));
    }, 30),
  );
}

async function authenticate(socket: Socket): Promise<SocketData | null> {
  const auth = socket.handshake.auth as Record<string, unknown>;
  if (auth.role === 'admin' && typeof auth.token === 'string' && verifyAdminToken(auth.token)) {
    const gameId = Number(auth.gameId);
    if (!Number.isInteger(gameId)) return null;
    const exists = await prisma.game.findUnique({ where: { id: gameId }, select: { id: true } });
    return exists ? { role: 'admin', gameId } : null;
  }
  if (auth.role === 'screen' && typeof auth.code === 'string') {
    const game = await prisma.game.findUnique({ where: { code: auth.code }, select: { id: true } });
    return game ? { role: 'screen', gameId: game.id } : null;
  }
  if (auth.role === 'player' && typeof auth.token === 'string' && auth.token.length > 10) {
    const player = await prisma.player.findUnique({ where: { token: auth.token } });
    if (!player || player.status === 'KICKED') return null;
    return { role: 'player', gameId: player.gameId, playerId: player.id, token: auth.token };
  }
  return null;
}

function replyError(ack: Ack | undefined, e: unknown) {
  if (e instanceof AppError) ack?.({ ok: false, error: e.code, details: e.details });
  else {
    console.error(e);
    ack?.({ ok: false, error: 'SERVER_ERROR' });
  }
}

export function setupSockets(server: Server) {
  io = server;

  io.use(async (socket, next) => {
    try {
      const data = await authenticate(socket);
      if (!data) return next(new Error('UNAUTHORIZED'));
      socket.data = data;
      next();
    } catch {
      next(new Error('SERVER_ERROR'));
    }
  });

  io.on('connection', async (socket) => {
    const data = socket.data as SocketData;

    // Серверге шайкеш саат (таймер баарында бирдей болушу үчүн)
    socket.on('time:sync', (cb: unknown) => {
      if (typeof cb === 'function') cb(Date.now());
    });

    if (data.role === 'admin') {
      socket.join(rooms.admin(data.gameId));
      socket.on('admin:action', async (action: AdminAction, ack?: Ack) => {
        try {
          await runAdminAction(data.gameId, action);
          ack?.({ ok: true });
        } catch (e) {
          replyError(ack, e);
        }
      });
    }

    if (data.role === 'screen') socket.join(rooms.screen(data.gameId));

    if (data.role === 'player') {
      socket.join([rooms.players(data.gameId), rooms.player(data.playerId)]);
      presence.add(data.playerId, socket.id);
      socket.on('player:answer', async (payload: { choice?: unknown }, ack?: Ack) => {
        try {
          await submitAnswer(data.gameId, data.playerId, payload?.choice);
          ack?.({ ok: true });
        } catch (e) {
          replyError(ack, e);
        }
      });
      socket.on('disconnect', () => {
        presence.remove(data.playerId, socket.id);
        scheduleBroadcast(data.gameId);
      });
    }

    // Жаңы туташкан ар бир кардар (баракча жаңыланса да) толук абалды алат
    scheduleBroadcast(data.gameId);
  });

  bus.on('game:changed', (gameId: number) => scheduleBroadcast(gameId));

  // Оюнчу жаңы түзмөктөн кирди / PIN жаңыланды / оюндан чыгарылды — эски түзмөктөрдү ажыратабыз
  bus.on('player:session', async (playerId: number) => {
    const player = await prisma.player.findUnique({ where: { id: playerId } });
    const sockets = await io.in(rooms.player(playerId)).fetchSockets();
    for (const s of sockets) {
      const d = s.data as SocketData;
      if (d.role !== 'player') continue;
      if (!player || player.status === 'KICKED') {
        s.emit('player:kicked');
        s.disconnect(true);
      } else if (d.token !== player.token) {
        s.emit('session:replaced');
        s.disconnect(true);
      }
    }
  });
}
