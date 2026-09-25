import { NextResponse } from 'next/server';
import { route, requireSameOrigin } from '@/src/server/http';
import { getEnv } from '@/src/server/env';
import { getSessionUser, revokeLocalSession, SESSION_COOKIE } from '@/src/server/auth/session';

export const POST = route(async () => {
  await requireSameOrigin();
  const env = getEnv();
  const user = await getSessionUser();
  const res = NextResponse.json({ ok: true });
  if (env.AUTH_DRIVER === 'local') {
    if (user?.sessionId) await revokeLocalSession(user.sessionId);
    res.cookies.set(SESSION_COOKIE, '', { maxAge: 0, path: '/' });
  } else {
    const { supabaseServer } = await import('@/src/server/auth/supabase');
    const sb = await supabaseServer();
    await sb.auth.signOut();
  }
  return res;
});
