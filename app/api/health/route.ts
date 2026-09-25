import { NextResponse } from 'next/server';
import { db } from '@/src/server/db';
import { getEnv } from '@/src/server/env';

export const dynamic = 'force-dynamic';

/** Exposes no credentials: mode flags, DB reachability and worker heartbeat age only. */
export async function GET() {
  const env = getEnv();
  let database = 'ok';
  let workerAgeSeconds: number | null = null;
  try {
    const hb = await db.one<{ age: string }>(`select extract(epoch from now() - max(last_seen_at))::text as age from public.worker_heartbeats`);
    workerAgeSeconds = hb?.age ? Math.round(Number(hb.age)) : null;
  } catch {
    database = 'unreachable';
  }
  return NextResponse.json({
    ok: database === 'ok',
    appMode: env.APP_MODE,
    providers: { auth: env.AUTH_DRIVER, storage: env.STORAGE_DRIVER, planner: env.PLANNER_PROVIDER, video: env.VIDEO_PROVIDER, payments: env.PAYMENTS_PROVIDER },
    database,
    worker: workerAgeSeconds === null ? 'no heartbeat' : workerAgeSeconds < 60 ? 'ok' : `stale (${workerAgeSeconds}s)`,
  });
}
