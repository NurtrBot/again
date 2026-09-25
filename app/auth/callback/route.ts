import { NextResponse } from 'next/server';
import { getEnv } from '@/src/server/env';
import { safeReturnTo } from '@/src/domain/helpers';
import { db } from '@/src/server/db';

/** OAuth PKCE callback (Supabase driver). Validates the code exchange and same-origin returnTo. */
export async function GET(req: Request) {
  const env = getEnv();
  const url = new URL(req.url);
  const returnTo = safeReturnTo(url.searchParams.get('returnTo'));
  if (env.AUTH_DRIVER !== 'supabase') return NextResponse.redirect(`${env.APP_URL}/auth`);
  const code = url.searchParams.get('code');
  if (!code) return NextResponse.redirect(`${env.APP_URL}/auth?error=oauth_canceled&returnTo=${encodeURIComponent(returnTo)}`);
  const { supabaseServer } = await import('@/src/server/auth/supabase');
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  if (error || !data.user?.email) return NextResponse.redirect(`${env.APP_URL}/auth?error=oauth_failed&returnTo=${encodeURIComponent(returnTo)}`);
  const profile = await db.one<{ onboarding_complete: boolean }>(
    `insert into public.profiles(id, email) values ($1,$2) on conflict (id) do update set email=excluded.email returning onboarding_complete`,
    [data.user.id, data.user.email],
  );
  await db.query('insert into public.credit_accounts(user_id) values ($1) on conflict do nothing', [data.user.id]);
  const next = profile!.onboarding_complete ? returnTo : `/onboarding?returnTo=${encodeURIComponent(returnTo)}`;
  return NextResponse.redirect(`${env.APP_URL}${next}`);
}
