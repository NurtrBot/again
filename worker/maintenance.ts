import { db } from '../src/server/db';
import { getEnv } from '../src/server/env';
import { creditsService } from '../src/server/services/credits';
import { enqueue } from '../src/server/services/outbox';

/** Runs about once a minute: credit expiry, stale-lease notice, unused upload purge, webhook replay. */
export async function runMaintenance() {
  const env = getEnv();
  const expired = await creditsService.expireGrants();
  if (expired) console.log(`[maintenance] expired ${expired} grant(s)`);

  // Unused uploads / drafts older than 7 days (proposed retention policy).
  const stale = (
    await db.query<{ id: string; user_id: string }>(
      `select m.id, m.user_id from public.media_assets m
       where m.kind in ('source','normalized') and m.state in ('ready','rejected','pending','validating') and m.created_at < now() - interval '7 days'
         and not exists (select 1 from public.films f where (f.source_asset_id = m.id or f.source_asset_id = m.parent_asset_id) and f.deleted_at is null)
         and not exists (select 1 from public.drafts d where (d.source_asset_id = m.id or d.normalized_asset_id = m.id) and d.status in ('generating','completed'))
         and not exists (select 1 from public.generations g where g.input_snapshot->>'normalizedAssetId' = m.id::text and g.status not in ('ready','failed','abandoned'))
       limit 50`,
    )
  ).rows;
  for (const a of stale) {
    await db.query(`update public.media_assets set state='deleting', updated_at=now() where id=$1`, [a.id]);
    await enqueue(db, 'delete_media', `delete_media:${a.id}`, { assetId: a.id, userId: a.user_id });
  }
  await db.query(`update public.drafts set status='invalid', updated_at=now() where status in ('ready','validating') and updated_at < now() - interval '7 days'`);

  // Long-held reservations are an operator signal (never auto-refunded here).
  const longHeld = await db.one<{ n: string }>(`select count(*)::text as n from public.credit_reservations where status='held' and created_at < now() - interval '2 hours'`);
  if (Number(longHeld?.n ?? 0) > 0) console.warn(`[maintenance] ${longHeld!.n} reservation(s) held > 2h — check provider attempts`);

  if (env.PAYMENTS_PROVIDER === 'stripe') {
    const { retryFailedEvents } = await import('../src/server/services/webhooks');
    const n = await retryFailedEvents(10);
    if (n) console.log(`[maintenance] replayed ${n} webhook event(s)`);
  }
  // Reap stale worker heartbeats.
  await db.query(`delete from public.worker_heartbeats where last_seen_at < now() - interval '1 day'`);
}
