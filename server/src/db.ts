import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import './config.js'; // .env жүктөлүшү үчүн

/**
 * TURSO_DATABASE_URL коюлса — интернеттеги Turso (libSQL) базасы колдонулат:
 * маалымат сервер кайра иштетилгенде да жоголбойт.
 * Коюлбаса — жергиликтүү SQLite файлы (ноутбукта интернетсиз иштөө үчүн).
 */
export const tursoUrl = process.env.TURSO_DATABASE_URL?.trim() || null;
export const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;

export const prisma = tursoUrl
  ? new PrismaClient({ adapter: new PrismaLibSQL({ url: tursoUrl, authToken: tursoToken }) })
  : new PrismaClient();
