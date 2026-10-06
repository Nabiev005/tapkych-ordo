import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config.js';
import { AppError } from './types.js';

const TOKEN_TTL = '24h';

/**
 * Кирген колдонуучу:
 *  - admin   — башкы алып баруучу (.env), бардыгын көрөт жана мугалимдерди башкарат
 *  - teacher — мугалим: өз суроолору, оюндары жана тапшырмалары гана
 */
export interface StaffUser {
  role: 'admin' | 'teacher';
  teacherId: number | null;
  name: string;
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function checkAdminCredentials(username: string, password: string): boolean {
  // Экөөн тең текшеребиз (кыска туташуусуз), убакыт боюнча ачыкка чыкпашы үчүн
  const u = safeEqual(username.toLowerCase(), config.adminUser.toLowerCase());
  const p = safeEqual(password, config.adminPass);
  return u && p;
}

/** Мугалимдин сыр сөзү: scrypt + туз (salt) */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 32);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

export function signStaffToken(user: StaffUser): string {
  return jwt.sign({ role: user.role, tid: user.teacherId, name: user.name }, config.jwtSecret, { expiresIn: TOKEN_TTL });
}

export function verifyStaffToken(token: string | undefined): StaffUser | null {
  if (!token) return null;
  try {
    const p = jwt.verify(token, config.jwtSecret) as { role?: string; tid?: number | null; name?: string };
    if (p.role === 'admin') return { role: 'admin', teacherId: null, name: p.name ?? 'Admin' };
    if (p.role === 'teacher' && typeof p.tid === 'number') return { role: 'teacher', teacherId: p.tid, name: p.name ?? '' };
    return null;
  } catch {
    return null;
  }
}

/** Мурунку код үчүн шайкештик */
export const verifyAdminToken = (token: string | undefined) => verifyStaffToken(token) !== null;

export function staff(res: Response): StaffUser {
  return res.locals.user as StaffUser;
}

/** Башкы алып баруучу же мугалим */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : undefined;
  const user = verifyStaffToken(token);
  if (!user) throw new AppError('UNAUTHORIZED', 401);
  res.locals.user = user;
  next();
}

/** Башкы алып баруучу гана (мугалимдерди, сезондорду башкаруу) */
export function requireSuper(req: Request, res: Response, next: NextFunction) {
  requireAdmin(req, res, () => {
    if (staff(res).role !== 'admin') throw new AppError('FORBIDDEN', 403);
    next();
  });
}

/** Ээлик: башкы алып баруучунун маалыматы ownerId = null, мугалимдики — анын id’си */
export const ownerKey = (user: StaffUser): number | null => user.teacherId;

/** Тизмелер үчүн чыпка: башкы алып баруучу оюндардын баарын көрөт, мугалим — өзүнүкүн гана */
export function ownedWhere(user: StaffUser): { ownerId?: number } {
  return user.role === 'admin' ? {} : { ownerId: user.teacherId! };
}

export function assertOwner(user: StaffUser, ownerId: number | null | undefined) {
  if (user.role === 'admin') return;
  if (ownerId !== user.teacherId) throw new AppError('NOT_FOUND', 404);
}

export function randomToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}
