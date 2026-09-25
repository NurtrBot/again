import 'server-only';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z, type ZodType } from 'zod';
import { getSessionUser, isSameOrigin, type SessionUser } from './auth/session';
import { canonicalHash, isUuid } from '@/src/domain/helpers';
import { db } from './db';
import { HttpError, notFound, unauthorized } from './errors';

export { HttpError, notFound, unauthorized };

export function errorResponse(err: unknown, requestId: string): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, requestId, retryable: err.retryable, fieldErrors: err.fieldErrors } },
      { status: err.status, headers: { 'x-request-id': requestId, ...(err.headers ?? {}) } },
    );
  }
  const code = (err as { code?: string })?.code;
  const message = (err as Error)?.message ?? 'unknown';
  console.error(`[api ${requestId}]`, code ?? '', message);
  return NextResponse.json(
    { error: { code: 'internal', message: 'Something went wrong on our side. Please try again.', requestId, retryable: true, fieldErrors: {} } },
    { status: 500, headers: { 'x-request-id': requestId } },
  );
}

export type Handler = (ctx: HandlerContext) => Promise<NextResponse | Response>;
export interface HandlerContext {
  req: Request;
  requestId: string;
  params: Record<string, string>;
  url: URL;
}

/** Wraps a route handler with request id + error envelope. */
export function route(handler: Handler) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    const requestId = randomUUID();
    try {
      const params = (await ctx?.params) ?? {};
      const res = await handler({ req, requestId, params, url: new URL(req.url) });
      if (res instanceof NextResponse) res.headers.set('x-request-id', requestId);
      return res;
    } catch (err) {
      return errorResponse(err, requestId);
    }
  };
}

export async function requireUser(req: Request): Promise<SessionUser> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (!(await isSameOrigin())) throw new HttpError(403, 'csrf', 'Cross-site request blocked.');
  }
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireSameOrigin() {
  if (!(await isSameOrigin())) throw new HttpError(403, 'csrf', 'Cross-site request blocked.');
}

export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, 'invalid_json', 'The request body is not valid JSON.');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join('.') || '_'] = issue.message;
    throw new HttpError(422, 'validation', 'Please check the highlighted fields.', { retryable: false, fieldErrors });
  }
  return parsed.data;
}

export function uuidParam(value: string | undefined, what = 'resource'): string {
  if (!isUuid(value)) throw notFound(what);
  return value;
}

export const ok = <T>(body: T, status = 200, headers?: Record<string, string>) => NextResponse.json(body, { status, headers });

export const zUuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, 'Invalid id');

/**
 * Idempotency for POST mutations: same (user, scope, key, payload) replays the
 * stored response; same key with a different payload -> 409.
 */
export async function withIdempotency<T>(
  user: SessionUser,
  scope: string,
  key: string | null,
  payload: unknown,
  fn: () => Promise<{ status: number; body: T }>,
): Promise<{ status: number; body: T; replayed: boolean }> {
  if (!key) {
    const r = await fn();
    return { ...r, replayed: false };
  }
  if (key.length > 200) throw new HttpError(400, 'bad_idempotency_key', 'Idempotency-Key is too long.');
  const hash = canonicalHash(payload);
  const existing = await db.one<{ payload_hash: string; response_status: number; response_body: T }>(
    'select payload_hash, response_status, response_body from public.idempotency_keys where user_id=$1 and scope=$2 and key=$3',
    [user.id, scope, key],
  );
  if (existing) {
    if (existing.payload_hash !== hash) throw new HttpError(409, 'idempotency_conflict', 'This request key was already used with different input.', { retryable: false });
    return { status: existing.response_status, body: existing.response_body, replayed: true };
  }
  const r = await fn();
  if (r.status < 500) {
    await db.query(
      `insert into public.idempotency_keys(user_id, scope, key, payload_hash, response_status, response_body) values ($1,$2,$3,$4,$5,$6)
       on conflict do nothing`,
      [user.id, scope, key, hash, r.status, JSON.stringify(r.body)],
    );
  }
  return { ...r, replayed: false };
}

/* ---------- tiny in-memory rate limiter (per process; DB-backed limits in services) ---------- */
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return;
  }
  b.count++;
  if (b.count > limit) {
    const retry = Math.ceil((b.reset - now) / 1000);
    throw new HttpError(429, 'rate_limited', 'Too many requests. Please wait a moment.', { retryable: true, headers: { 'Retry-After': String(retry) } });
  }
  if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
}

export async function clientIp(req: Request): Promise<string> {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'local').trim();
}
