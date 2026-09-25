import 'server-only';
import { cookies, headers } from 'next/headers';
import { getEnv } from '../env';
import { db } from '../db';
import { hmacHex, randomToken, safeEqual } from '@/src/domain/helpers';

export const SESSION_COOKIE = 'again_session';
const SESSION_TTL_DAYS = 30;

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  onboardingComplete: boolean;
  createdAt: string;
  sessionId?: string;
  /** Unix ms when the session (or Supabase sign-in) was established; used for reauth-sensitive actions. */
  authenticatedAt: number;
}

/* ---------- cookie signing (local driver) ---------- */
function sign(value: string): string {
  return `${value}.${hmacHex(getEnv().APP_SECRET, `session:${value}`)}`;
}
function verify(signed: string | undefined): string | null {
  if (!signed) return null;
  const idx = signed.lastIndexOf('.');
  if (idx < 0) return null;
  const value = signed.slice(0, idx);
  const mac = signed.slice(idx + 1);
  return safeEqual(mac, hmacHex(getEnv().APP_SECRET, `session:${value}`)) ? value : null;
}

/** Creates a DB-backed session (local driver) and returns the Set-Cookie value pieces. */
export async function createLocalSession(userId: string) {
  const id = randomToken(32);
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000);
  await db.query('insert into public.auth_sessions(id, user_id, expires_at) values ($1,$2,$3)', [id, userId, expires]);
  return { name: SESSION_COOKIE, value: sign(id), expires };
}

export function sessionCookieOptions(expires?: Date) {
  const env = getEnv();
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.APP_URL.startsWith('https://'),
    path: '/',
    expires,
  };
}

export async function revokeLocalSession(sessionId: string) {
  await db.query('update public.auth_sessions set revoked_at = now() where id = $1 and revoked_at is null', [sessionId]);
}

async function ensureProfile(userId: string, email: string): Promise<SessionUser | null> {
  const row = await db.one<{
    id: string;
    email: string;
    display_name: string;
    onboarding_complete: boolean;
    created_at: Date;
  }>(
    `insert into public.profiles(id, email) values ($1, $2)
     on conflict (id) do update set email = excluded.email, updated_at = now()
     returning id, email, display_name, onboarding_complete, created_at`,
    [userId, email],
  );
  if (!row) return null;
  await db.query('insert into public.credit_accounts(user_id) values ($1) on conflict do nothing', [userId]);
  return { id: row.id, email: row.email, displayName: row.display_name, onboardingComplete: row.onboarding_complete, createdAt: row.created_at.toISOString(), authenticatedAt: 0 };
}

/** Resolve the current user from cookies. Works in route handlers and server components. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const env = getEnv();
  const jar = await cookies();
  if (env.AUTH_DRIVER === 'local') {
    const id = verify(jar.get(SESSION_COOKIE)?.value);
    if (!id) return null;
    const row = await db.one<{ id: string; user_id: string; email: string; created_at: Date; expires_at: Date }>(
      `select s.id, s.user_id, u.email, s.created_at, s.expires_at from public.auth_sessions s join auth.users u on u.id = s.user_id
       where s.id = $1 and s.revoked_at is null and s.expires_at > now()`,
      [id],
    );
    if (!row) return null;
    void db.query('update public.auth_sessions set last_seen_at = now() where id = $1 and last_seen_at < now() - interval \'5 minutes\'', [id]).catch(() => {});
    const user = await ensureProfile(row.user_id, row.email);
    if (!user) return null;
    return { ...user, sessionId: row.id, authenticatedAt: row.created_at.getTime() };
  }
  // Supabase driver
  const { getSupabaseUser } = await import('./supabase');
  const su = await getSupabaseUser();
  if (!su) return null;
  const user = await ensureProfile(su.id, su.email);
  if (!user) return null;
  return { ...user, authenticatedAt: su.authenticatedAt };
}

/** True when the request is a same-origin browser request (CSRF guard for cookie-authenticated mutations). */
export async function isSameOrigin(): Promise<boolean> {
  const h = await headers();
  const fetchSite = h.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return false;
  const origin = h.get('origin');
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (origin && host) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return true;
}
