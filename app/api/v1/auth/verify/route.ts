import { z } from 'zod';
import { NextResponse } from 'next/server';
import { route, readJson, requireSameOrigin, rateLimit, clientIp, HttpError } from '@/src/server/http';
import { getEnv } from '@/src/server/env';
import { localAuth } from '@/src/server/auth/local';
import { sessionCookieOptions } from '@/src/server/auth/session';
import { safeReturnTo } from '@/src/domain/helpers';

const schema = z.object({ challengeId: z.string().max(64), code: z.string().regex(/^[0-9]{6}$/, 'Enter the 6-digit code') });

export const POST = route(async ({ req }) => {
  await requireSameOrigin();
  const body = await readJson(req, schema);
  rateLimit(`verify:ip:${await clientIp(req)}`, 30, 15 * 60_000);
  const env = getEnv();
  if (env.AUTH_DRIVER === 'local') {
    const r = await localAuth.verifyOtp(body.challengeId, body.code);
    const res = NextResponse.json({ nextPath: r.nextPath, isNewUser: r.isNewUser });
    res.cookies.set(r.cookie.name, r.cookie.value, sessionCookieOptions(r.cookie.expires));
    return res;
  }
  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const raw = jar.get('again_otp')?.value;
  if (!raw) throw new HttpError(401, 'code_expired', 'That code has expired. Request a new one.', { retryable: false });
  const { email, returnTo } = JSON.parse(raw) as { email: string; returnTo: string };
  const { supabaseServer } = await import('@/src/server/auth/supabase');
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.verifyOtp({ email, token: body.code, type: 'email' });
  if (error || !data.user) throw new HttpError(401, /expired/i.test(error?.message ?? '') ? 'code_expired' : 'code_invalid', 'That code isn’t right. Check the email and try again.', { retryable: false });
  const { db } = await import('@/src/server/db');
  const profile = await db.one<{ onboarding_complete: boolean; created_at: Date }>(
    `insert into public.profiles(id, email) values ($1,$2) on conflict (id) do update set email=excluded.email returning onboarding_complete, created_at`,
    [data.user.id, email],
  );
  await db.query('insert into public.credit_accounts(user_id) values ($1) on conflict do nothing', [data.user.id]);
  const isNewUser = Date.now() - profile!.created_at.getTime() < 60_000;
  const next = safeReturnTo(returnTo);
  const res = NextResponse.json({ nextPath: !profile!.onboarding_complete ? `/onboarding?returnTo=${encodeURIComponent(next)}` : next, isNewUser });
  res.cookies.set('again_otp', '', { maxAge: 0, path: '/' });
  return res;
});
