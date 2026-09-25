import type { Db } from '../db';

export type OutboxType =
  | 'normalize_media'
  | 'plan_generation'
  | 'submit_generation'
  | 'poll_generation'
  | 'finalize_generation'
  | 'release_generation'
  | 'delete_media'
  | 'expire_grants'
  | 'reconcile_payment'
  | 'reconcile_unknown_submission'
  | 'delete_account'
  | 'mock_render';

/** Durable, deduplicated task. Same dedupe key = same logical action (no duplicate rows). */
export async function enqueue(db: Db, type: OutboxType, dedupeKey: string, payload: Record<string, unknown>, opts: { delayMs?: number; maxAttempts?: number } = {}) {
  const available = new Date(Date.now() + (opts.delayMs ?? 0));
  await db.query(
    `insert into public.outbox(event_type, dedupe_key, payload, available_at, max_attempts) values ($1,$2,$3,$4,$5)
     on conflict (dedupe_key) do nothing`,
    [type, dedupeKey, JSON.stringify(payload), available, opts.maxAttempts ?? 50],
  );
}
