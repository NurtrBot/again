import { z } from 'zod';
import { route, readJson, ok, requireSameOrigin, HttpError } from '@/src/server/http';
import { getEnv } from '@/src/server/env';
import { safeReturnTo } from '@/src/domain/helpers';

const schema = z.object({ provider: z.enum(['apple', 'google']), returnTo: z.string().max(512).optional() });

export const POST = route(async ({ req }) => {
  await requireSameOrigin();
  const body = await readJson(req, schema);
  const env = getEnv();
  if (!env.oauthProviders.includes(body.provider)) throw new HttpError(404, 'provider_unavailable', 'That sign-in method isn’t available.', { retryable: false });
  const { supabaseServer } = await import('@/src/server/auth/supabase');
  const sb = await supabaseServer();
  const returnTo = safeReturnTo(body.returnTo);
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: body.provider,
    options: { redirectTo: `${env.APP_URL}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw new HttpError(503, 'oauth_unavailable', 'That sign-in method is temporarily unavailable.');
  return ok({ url: data.url });
});
