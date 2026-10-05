/**
 * Базанын түзүлүшүн жаңыртуу (сервер иштээрден мурун).
 *  - Жергиликтүү SQLite: `prisma migrate deploy`
 *  - Turso: prisma/migrations ичиндеги SQL файлдарын өзүбүз колдонобуз
 *    (Prisma CLI Turso’го түз миграция кыла албайт).
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { SERVER_ROOT } from './config.js';

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;

async function migrateTurso(dbUrl: string) {
  const client = createClient({ url: dbUrl, authToken });
  await client.execute('CREATE TABLE IF NOT EXISTS "_ordo_migrations" ("name" TEXT PRIMARY KEY, "appliedAt" TEXT NOT NULL)');
  const done = new Set((await client.execute('SELECT name FROM "_ordo_migrations"')).rows.map((r) => String(r.name)));

  const dir = path.join(SERVER_ROOT, 'prisma', 'migrations');
  const names = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const name of names) {
    if (done.has(name)) continue;
    const sql = fs.readFileSync(path.join(dir, name, 'migration.sql'), 'utf8');
    console.log(`  ↻ Миграция: ${name}`);
    await client.executeMultiple(sql);
    await client.execute({ sql: 'INSERT INTO "_ordo_migrations" (name, appliedAt) VALUES (?, ?)', args: [name, new Date().toISOString()] });
  }
  client.close();
  console.log('  ✓ Turso базасы даяр');
}

if (url) {
  await migrateTurso(url);
} else {
  execSync('npx prisma migrate deploy', { cwd: SERVER_ROOT, stdio: 'inherit' });
}
