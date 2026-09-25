import { randomUUID } from 'node:crypto';
import { db, withTransaction } from '../src/server/db';
import { runMigrations } from '../src/server/migrations';
import { creditsService } from '../src/server/services/credits';

export async function migrateTestDb() {
  await runMigrations({ databaseUrl: process.env.DATABASE_URL!, includeLocal: true });
}

export async function truncateAll() {
  await db.query(`truncate public.outbox, public.idempotency_keys, public.webhook_events, public.support_tickets, public.credit_events, public.credit_reservations, public.credit_grants, public.provider_attempts, public.films, public.generations, public.drafts, public.media_assets, public.orders, public.subscriptions, public.credit_accounts, public.profiles, public.auth_sessions, public.auth_otp_challenges cascade`);
  await db.query('delete from auth.users');
}

export async function makeUser(email = `${randomUUID().slice(0, 8)}@test.local`): Promise<string> {
  const u = await db.one<{ id: string }>('insert into auth.users(email) values ($1) returning id', [email]);
  await db.query('insert into public.profiles(id, email, onboarding_complete) values ($1,$2,true)', [u!.id, email]);
  await db.query('insert into public.credit_accounts(user_id) values ($1)', [u!.id]);
  return u!.id;
}

export async function grant(userId: string, credits: number, opts: { kind?: 'purchase' | 'monthly'; expiresAt?: Date | null; sourceKey?: string } = {}) {
  return withTransaction(async (tx) => {
    await creditsService.lockAccount(tx, userId);
    return creditsService.grant(tx, userId, { kind: opts.kind ?? 'purchase', sourceKey: opts.sourceKey ?? `test:${randomUUID()}`, credits, description: 'test', expiresAt: opts.expiresAt ?? null });
  });
}

/** A ready source + normalized asset and a ready draft, without touching storage. */
export async function makeDraft(userId: string): Promise<{ draftId: string; sourceId: string; normalizedId: string }> {
  const sourceId = randomUUID();
  const normalizedId = randomUUID();
  await db.query(`insert into public.media_assets(id, user_id, kind, storage_bucket, object_key, state, mime_type, byte_length, width, height) values ($1,$2,'source','sources',$3,'ready','image/jpeg',1000,800,600)`, [sourceId, userId, `${userId}/${sourceId}.jpg`]);
  await db.query(`insert into public.media_assets(id, user_id, kind, storage_bucket, object_key, state, mime_type, byte_length, width, height, parent_asset_id) values ($1,$2,'normalized','normalized',$3,'ready','image/jpeg',900,800,600,$4)`, [normalizedId, userId, `${userId}/${normalizedId}.jpg`, sourceId]);
  const d = await db.one<{ id: string }>(`insert into public.drafts(user_id, source_asset_id, normalized_asset_id, status) values ($1,$2,$3,'ready') returning id`, [userId, sourceId, normalizedId]);
  return { draftId: d!.id, sourceId, normalizedId };
}

export async function makeVideoAsset(userId: string): Promise<string> {
  const id = randomUUID();
  await db.query(`insert into public.media_assets(id, user_id, kind, storage_bucket, object_key, state, mime_type, byte_length, width, height, duration_seconds) values ($1,$2,'video','films',$3,'ready','video/mp4',5000,800,600,10.04)`, [id, userId, `${userId}/${id}.mp4`]);
  return id;
}
