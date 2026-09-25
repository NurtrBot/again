import { z } from 'zod';
import { route, readJson, ok, requireSameOrigin, rateLimit, clientIp, HttpError } from '@/src/server/http';
import { getEnv } from '@/src/server/env';
import { localAuth } from '@/src/server/auth/local';
import { safeReturnTo } from '@/src/domain/helpers';

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254), returnTo: z.string().max(512).optional() });

export const POST = route(async ({ req }) => {
  await requireSameOrigin();
  const body = await readJson(req, schema);
  rateLimit(`otp:ip:${await clientIp(req)}`, 20, 15 * 60_000);
  rateLimit(`otp:email:${body.email}`, 6, 15 * 60_000);
  const env = getEnv();
  if (env.AUTH_DRIVER === 'local') {
    const r = await localAuth.startOtp(body.email, body.returnTo);
    return ok(r, 202);
  }
  const { supabaseServer } = await import('@/src/server/auth/supabase');
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithOtp({ email: body.email, options: { shouldCreateUser: true } });
  if (error) {
    if (/rate/i.test(error.message)) throw new HttpError(429, 'rate_limited', 'Too many codes requested. Try again later.', { headers: { 'Retry-After': '60' } });
    throw new HttpError(503, 'mail_unavailable', 'We couldn’t send the code right now. Please try again shortly.');
  }
  // Supabase keeps the challenge server-side; we carry email+returnTo in an HttpOnly cookie for /verify.
  const { cookies } = await import('next/headers');
  const jar = await cookies();
  jar.set('again_otp', JSON.stringify({ email: body.email, returnTo: safeReturnTo(body.returnTo) }), { httpOnly: true, sameSite: 'lax', secure: env.APP_URL.startsWith('https://'), path: '/', maxAge: 900 });
  return ok({ challengeId: '00000000-0000-4000-8000-000000000000', resendAfterSeconds: 60 }, 202);
});
