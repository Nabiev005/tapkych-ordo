import dotenv from 'dotenv';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** server/ папкасы — src/ же dist/ ичинен иштетилсе да, кайсы папкадан ишке киргизилсе да бирдей */
export const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(SERVER_ROOT, '.env') });

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`.env файлында ${name} коюлган эмес`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  adminUser: required('ADMIN_USER', 'admin'),
  adminPass: required('ADMIN_PASS', 'ordo2026'),
  jwtSecret: required('JWT_SECRET', 'dev-secret-change-me'),
  publicUrl: (process.env.PUBLIC_URL ?? '').replace(/\/$/, ''),
  isProd: process.env.NODE_ENV === 'production',
};

/** Ноутбуктун жергиликтүү тармактагы IP дареги (телефондор кирүүсү үчүн) */
export function getLanIp(): string | null {
  const nets = os.networkInterfaces();
  const candidates: string[] = [];
  for (const list of Object.values(nets)) {
    for (const n of list ?? []) {
      if (n.family === 'IPv4' && !n.internal) candidates.push(n.address);
    }
  }
  // Үй/офис Wi-Fi тармактарын биринчи орунга коёбуз
  return (
    candidates.find((a) => a.startsWith('192.168.')) ??
    candidates.find((a) => a.startsWith('10.')) ??
    candidates.find((a) => /^172\.(1[6-9]|2\d|3[01])\./.test(a)) ??
    candidates[0] ??
    null
  );
}
