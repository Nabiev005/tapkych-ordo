/**
 * Тесттер үчүн жардамчылар.
 * Ар бир тест файлы өзүнүн серверин бош портто жана өзүнчө SQLite базасында иштетет —
 * иштеп жаткан dev сервер (:3000) жана анын dev.db базасы колдонулбайт.
 */
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io, type Socket } from 'socket.io-client';

export const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const ADMIN = { username: 'admin', password: 'test-pass-123' };

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
  });
}

export interface TestServer {
  url: string;
  stop(): Promise<void>;
}

/** Таза база менен серверди иштетет (миграциялар колдонулат, seed жок) */
export async function startServer(name: string): Promise<TestServer> {
  const port = await freePort();
  const dbFile = `test-${name}-${process.pid}.db`;
  const dbPath = path.join(SERVER_DIR, 'prisma', dbFile);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(port),
    DATABASE_URL: `file:./${dbFile}`,
    ADMIN_USER: ADMIN.username,
    ADMIN_PASS: ADMIN.password,
    JWT_SECRET: 'test-jwt-secret',
    GOOGLE_CLIENT_ID: '',
    ADMIN_EMAILS: '',
    TURSO_DATABASE_URL: '',
    TURSO_AUTH_TOKEN: '',
    RENDER: '',
  };
  for (const f of [dbPath, `${dbPath}-journal`]) fs.rmSync(f, { force: true });
  execSync('npx prisma migrate deploy', { cwd: SERVER_DIR, env, stdio: 'pipe' });

  const child: ChildProcess = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], { cwd: SERVER_DIR, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout?.on('data', (d) => (output += d));
  child.stderr?.on('data', (d) => (output += d));

  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`Сервер токтоп калды:\n${output}`);
    try {
      if ((await fetch(`${url}/api/health`)).ok) break;
    } catch {
      /* али даяр эмес */
    }
    if (Date.now() > deadline) {
      child.kill();
      throw new Error(`Сервер 30 секундда даяр болгон жок:\n${output}`);
    }
    await sleep(200);
  }

  return {
    url,
    async stop() {
      if (child.exitCode === null) {
        const exited = new Promise((r) => child.once('exit', r));
        child.kill();
        await exited;
      }
      // Windows файлды бир аз убакыт кармап турушу мүмкүн
      for (let i = 0; i < 20; i++) {
        try {
          for (const f of [dbPath, `${dbPath}-journal`]) fs.rmSync(f, { force: true });
          break;
        } catch {
          await sleep(100);
        }
      }
    },
  };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ApiResult<T = any> {
  status: number;
  body: T;
}

/** JSON API чакыруу. Ката болсо да ыргытпайт — статусту текшерүү тесттин иши. */
export async function api<T = any>(base: string, method: string, url: string, opts: { token?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  const res = await fetch(base + url, {
    method,
    headers: {
      ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* JSON эмес */
  }
  return { status: res.status, body };
}

export async function adminLogin(base: string): Promise<string> {
  const r = await api(base, 'POST', '/api/auth/login', { body: ADMIN });
  if (r.status !== 200) throw new Error(`Логин иштеген жок: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.token;
}

export function choiceQuestion(round: 'ROUND1' | 'ROUND2' | 'FINAL', text: string, correct: 'A' | 'B' | 'C' | 'D' = 'A') {
  return { round, type: 'CHOICE', text, optionA: 'А вариант', optionB: 'Б вариант', optionC: 'В вариант', optionD: 'Г вариант', correct };
}

// ───────────────────────── Socket.IO ─────────────────────────

/** Акыркы алынган абалды сактап, керектүү абалды күтө алган туташуу */
export class Client {
  socket: Socket;
  state: any = null;
  events: string[] = [];
  private waiters: { pred: (s: any) => boolean; resolve: (s: any) => void }[] = [];

  constructor(base: string, auth: Record<string, unknown>) {
    this.socket = io(base, { auth, transports: ['websocket'], reconnection: false, forceNew: true });
    this.socket.on('state', (s) => {
      this.state = s;
      this.waiters = this.waiters.filter((w) => {
        if (!w.pred(s)) return true;
        w.resolve(s);
        return false;
      });
    });
    for (const e of ['player:kicked', 'session:replaced', 'game:deleted']) this.socket.on(e, () => this.events.push(e));
  }

  connected(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket.connected) return resolve();
      this.socket.once('connect', () => resolve());
      this.socket.once('connect_error', (e) => reject(e));
    });
  }

  /** Шартка туура келген абал келгенче күтөт (учурдагы абал туура келсе — дароо) */
  waitFor(pred: (s: any) => boolean, timeoutMs = 5000): Promise<any> {
    if (this.state && pred(this.state)) return Promise.resolve(this.state);
    return new Promise((resolve, reject) => {
      const w = { pred, resolve };
      this.waiters.push(w);
      setTimeout(() => {
        this.waiters = this.waiters.filter((x) => x !== w);
        reject(new Error(`Абал ${timeoutMs} мс ичинде келген жок. Акыркы: ${JSON.stringify(this.state?.game ?? this.state)}`));
      }, timeoutMs);
    });
  }

  emit(event: string, payload: unknown): Promise<{ ok: boolean; error?: string; details?: unknown }> {
    return new Promise((resolve) => this.socket.emit(event, payload, resolve));
  }

  close() {
    this.socket.close();
  }
}
