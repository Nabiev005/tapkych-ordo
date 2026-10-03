/** Кайсы оюнчу азыр онлайн экенин эсептейт (бир оюнчуда бир нече socket болушу мүмкүн) */
const online = new Map<number, Set<string>>();

export const presence = {
  add(playerId: number, socketId: string) {
    const set = online.get(playerId) ?? new Set();
    set.add(socketId);
    online.set(playerId, set);
  },
  remove(playerId: number, socketId: string) {
    const set = online.get(playerId);
    if (!set) return;
    set.delete(socketId);
    if (set.size === 0) online.delete(playerId);
  },
  isOnline(playerId: number): boolean {
    return online.has(playerId);
  },
};
