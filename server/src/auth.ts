import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config.js';
import { AppError } from './types.js';

const TOKEN_TTL = '24h';

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

export function signAdminToken(): string {
  return jwt.sign({ role: 'admin' }, config.jwtSecret, { expiresIn: TOKEN_TTL });
}

export function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { role?: string };
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!verifyAdminToken(token)) throw new AppError('UNAUTHORIZED', 401);
  next();
}

export function randomToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}
