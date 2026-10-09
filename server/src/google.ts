import { config } from './config.js';
import { AppError } from './types.js';

/**
 * «Google менен кирүү»: браузерден келген ID-токенди Google'дун өзү аркылуу текшеребиз
 * (tokeninfo — кошумча китепкана талап кылынбайт). Кайтарат: текшерилген Gmail жана аты.
 */
export async function verifyGoogleCredential(credential: string): Promise<{ email: string; name: string }> {
  if (!config.googleClientId) throw new AppError('GOOGLE_DISABLED', 404);

  let info: Record<string, string>;
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(String(res.status));
    info = (await res.json()) as Record<string, string>;
  } catch {
    throw new AppError('GOOGLE_FAILED', 401);
  }

  const issuerOk = info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com';
  const fresh = Number(info.exp) * 1000 > Date.now();
  // Токен башка сайт үчүн берилген болсо (aud) же Gmail ырасталбаса — кабыл алынбайт
  if (info.aud !== config.googleClientId || !issuerOk || !fresh || String(info.email_verified) !== 'true' || !info.email) {
    throw new AppError('GOOGLE_FAILED', 401);
  }
  return { email: info.email.trim().toLowerCase(), name: info.name || info.email };
}
