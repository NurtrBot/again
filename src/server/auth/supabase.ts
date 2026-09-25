import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getEnv } from '../env';

export async function supabaseServer() {
  const env = getEnv();
  const jar = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          for (const c of list) jar.set(c.name, c.value, c.options);
        } catch {
          /* called from a Server Component: cookies are refreshed by middleware instead */
        }
      },
    },
  });
}

export async function getSupabaseUser(): Promise<{ id: string; email: string; authenticatedAt: number } | null> {
  const env = getEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  const u = data.user;
  if (!u || !u.email) return null;
  const at = u.last_sign_in_at ? Date.parse(u.last_sign_in_at) : 0;
  return { id: u.id, email: u.email, authenticatedAt: at };
}
