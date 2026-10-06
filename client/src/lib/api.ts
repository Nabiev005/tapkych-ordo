import { errorText } from '../i18n/ky';

/**
 * Сервердин дареги. Бош болсо — сайт менен бир эле дарек (ноутбукта же бир серверде иштегенде).
 * Vercel’де: VITE_API_URL=https://tapkych-ordo.onrender.com
 */
export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');

/** Сервердеги сүрөттөрдүн толук дареги (/uploads/... → https://сервер/uploads/...) */
export const assetUrl = (u: string | null | undefined) => (u && u.startsWith('/uploads/') ? API_BASE + u : (u ?? undefined));

const TOKEN_KEY = 'ordo_admin_token';

export const adminToken = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* жеке режим */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* жеке режим */
    }
  },
};

/** Кирген колдонуучу (башкы алып баруучу же мугалим) — навигация үчүн */
export interface StaffUser {
  role: 'admin' | 'teacher';
  name: string;
}
const USER_KEY = 'ordo_admin_user';
export const staffUser = {
  get: (): StaffUser | null => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null');
    } catch {
      return null;
    }
  },
  set: (u: StaffUser) => {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(u));
    } catch {
      /* жеке режим */
    }
  },
};

export class ApiError extends Error {
  constructor(
    public code: string,
    public details?: unknown,
  ) {
    super(errorText(code, details));
  }
}

async function request<T>(method: string, path: string, body?: unknown, isForm = false): Promise<T> {
  const headers: Record<string, string> = {};
  const token = adminToken.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('NETWORK');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && data.error === 'UNAUTHORIZED') {
      adminToken.clear();
      if (location.pathname.startsWith('/admin') && location.pathname !== '/admin/login') {
        location.href = '/admin/login';
      }
    }
    throw new ApiError(data.error ?? 'UNKNOWN', data.details);
  }
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {}),
  put: <T>(p: string, b?: unknown) => request<T>('PUT', p, b ?? {}),
  patch: <T>(p: string, b?: unknown) => request<T>('PATCH', p, b ?? {}),
  del: <T>(p: string) => request<T>('DELETE', p),
  upload: <T>(p: string, form: FormData) => request<T>('POST', p, form, true),
};

/** Авторизация менен файл жүктөп алуу (Excel экспорт, шаблон) */
export async function downloadFile(path: string, filename: string) {
  const token = adminToken.get();
  const res = await fetch(API_BASE + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => {
    throw new ApiError('NETWORK');
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error ?? 'UNKNOWN');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** QR-код жана PIN карточкалары үчүн телефондор кире турган дарек */
let joinBaseCache: string | null = null;
export async function getJoinBase(): Promise<string> {
  if (joinBaseCache) return joinBaseCache;
  const info = await api.get<{ publicUrl: string | null; lanIp: string | null }>('/api/info').catch(() => null);
  const local = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
  if (info?.publicUrl) joinBaseCache = info.publicUrl;
  else if (local && info?.lanIp) joinBaseCache = `${location.protocol}//${info.lanIp}${location.port ? ':' + location.port : ''}`;
  else joinBaseCache = location.origin;
  return joinBaseCache;
}
