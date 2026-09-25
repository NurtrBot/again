import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Order-independent JSON hash (ported from handoff/reference-code/domain.mjs). */
export function canonicalHash(value: unknown): string {
  const canon = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canon)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.keys(v as Record<string, unknown>)
              .sort()
              .map((k) => [k, canon((v as Record<string, unknown>)[k])]),
          )
        : v;
  return createHash('sha256').update(JSON.stringify(canon(value))).digest('hex');
}

export function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

export function hmacHex(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Same-origin path filter for returnTo (ported from reference domain.mjs). */
export function safeReturnTo(path: unknown, fallback = '/create'): string {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || /[\\\x00-\x1f]/.test(path)) return fallback;
  try {
    const u = new URL(path, 'https://again.invalid');
    return u.origin === 'https://again.invalid' ? u.pathname + u.search + u.hash : fallback;
  } catch {
    return fallback;
  }
}

export function withinDurationTolerance(seconds: number, target = 10, tolerance = 0.15): boolean {
  return Number.isFinite(seconds) && Math.abs(seconds - target) <= tolerance;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

export type Feeling = 'gentle' | 'lively' | 'surprise';
export const FEELINGS: Feeling[] = ['gentle', 'lively', 'surprise'];
export function isFeeling(v: unknown): v is Feeling {
  return v === 'gentle' || v === 'lively' || v === 'surprise';
}

export const FEELING_HINTS: Record<Feeling, { label: string; hint: string }> = {
  gentle: { label: 'Gentle', hint: 'A little breeze. A curious glance.' },
  lively: { label: 'Lively', hint: 'A bigger smile. A playful turn.' },
  surprise: { label: 'Surprise me', hint: 'A tasteful twist from what’s already there.' },
};

export function initialsFor(name: string, email: string): string {
  const src = name.trim() || email.split('@')[0] || '?';
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : src.slice(0, 1);
  return chars.toUpperCase();
}
