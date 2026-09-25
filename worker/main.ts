/* again. worker — persistent Node process. Leases outbox tasks from Postgres (SKIP LOCKED),
 * runs the generation pipeline (plan → submit → poll → finalize), media normalization,
 * purges, credit expiry and reconciliation. Never depends on browser polling.
 * Run: npm run worker   (DATABASE_URL + provider env from .env.local) */
import { loadEnv } from '../src/server/load-env';
loadEnv();
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { db, closePool } from '../src/server/db';
import { getEnv } from '../src/server/env';
import { runTask, type TaskRow } from './tasks';
import { runMaintenance } from './maintenance';

const WORKER_ID = `${hostname()}-${process.pid}-${randomUUID().slice(0, 6)}`;
const LEASE_SECONDS = 60;
const POLL_IDLE_MS = 500;
let stopping = false;

async function heartbeat() {
  await db.query(
    `insert into public.worker_heartbeats(worker_id, version) values ($1,$2) on conflict (worker_id) do update set last_seen_at=now()`,
    [WORKER_ID, process.env.npm_package_version ?? 'dev'],
  ).catch((e) => console.error('[worker] heartbeat failed', (e as Error).message));
}

async function lease(): Promise<TaskRow | null> {
  const env = getEnv();
  return db.one<TaskRow>(
    `with next as (
       select id from public.outbox
       where completed_at is null and available_at <= now() and (lease_expires_at is null or lease_expires_at < now()) and attempts < max_attempts
       order by available_at asc limit 1 for update skip locked
     )
     update public.outbox o set lease_owner=$1, lease_expires_at=now() + ($2 || ' seconds')::interval, attempts=attempts+1
     from next where o.id=next.id returning o.*`,
    [WORKER_ID, String(LEASE_SECONDS)],
  ).then((row) => {
    if (row && row.event_type === 'submit_generation' && env.GLOBAL_GENERATION_CONCURRENCY <= 0) return null;
    return row;
  });
}

async function complete(id: string) {
  await db.query('update public.outbox set completed_at=now(), lease_owner=null, lease_expires_at=null, last_error_code=null where id=$1', [id]);
}

async function retryLater(id: string, delayMs: number, code: string) {
  await db.query('update public.outbox set available_at=now() + ($2 || \' milliseconds\')::interval, lease_owner=null, lease_expires_at=null, last_error_code=$3 where id=$1', [id, String(Math.round(delayMs)), code.slice(0, 120)]);
}

function backoff(attempts: number): number {
  const base = Math.min(10 * 60_000, 2000 * Math.pow(2, Math.min(attempts, 8)));
  return base * (0.7 + Math.random() * 0.6);
}

async function loop() {
  console.log(`[worker] ${WORKER_ID} starting (mode=${getEnv().APP_MODE}, planner=${getEnv().PLANNER_PROVIDER}, video=${getEnv().VIDEO_PROVIDER})`);
  await heartbeat();
  let lastMaintenance = 0;
  while (!stopping) {
    try {
      if (Date.now() - lastMaintenance > 60_000) {
        lastMaintenance = Date.now();
        await heartbeat();
        await runMaintenance().catch((e) => console.error('[worker] maintenance failed', (e as Error).message));
      }
      const task = await lease();
      if (!task) {
        await new Promise((r) => setTimeout(r, POLL_IDLE_MS));
        continue;
      }
      const renew = setInterval(() => {
        db.query('update public.outbox set lease_expires_at=now() + ($2 || \' seconds\')::interval where id=$1 and lease_owner=$3', [task.id, String(LEASE_SECONDS), WORKER_ID]).catch(() => {});
      }, 15_000);
      try {
        const result = await runTask(task);
        if (result.kind === 'done') await complete(task.id);
        else await retryLater(task.id, result.delayMs, result.reason);
      } catch (err) {
        const msg = (err as Error).message ?? 'error';
        console.error(`[worker] task ${task.event_type} ${task.id} failed (attempt ${task.attempts}):`, msg);
        await retryLater(task.id, backoff(task.attempts), msg);
      } finally {
        clearInterval(renew);
      }
    } catch (err) {
      console.error('[worker] loop error', (err as Error).message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  await closePool();
  console.log('[worker] stopped');
}

process.on('SIGINT', () => (stopping = true));
process.on('SIGTERM', () => (stopping = true));
loop().catch((e) => {
  console.error(e);
  process.exit(1);
});
