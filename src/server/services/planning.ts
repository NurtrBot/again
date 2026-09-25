/* Shared planning helpers: cache key, cache read/write, and the pre-plan hook used by drafts. */
import { db, type Db } from '../db';
import { getEnv } from '../env';
import { storage } from '../storage';
import { enqueue } from './outbox';
import type { MediaRow } from './media';
import { sha256Hex, type Feeling } from '@/src/domain/helpers';
import { PROMPT_VERSION, type MotionPlan } from '@/src/providers/astra';

export function planCacheKey(imageHash: string, feeling: Feeling, direction: string): string {
  const env = getEnv();
  return `plan:${imageHash}:${feeling}:${sha256Hex(direction)}:${PROMPT_VERSION}:${env.PLANNER_PROVIDER}:${env.OPENAI_MODEL}:${env.ASTRA_REASONING_EFFORT}:${env.ASTRA_IMAGE_DETAIL}`;
}

export async function readPlanCache(key: string): Promise<MotionPlan | null> {
  const row = await db.one<{ plan: MotionPlan }>('select plan from public.plan_cache where cache_key=$1', [key]);
  return row?.plan ?? null;
}

export async function writePlanCache(conn: Db, key: string, userId: string, plan: MotionPlan) {
  await conn.query('insert into public.plan_cache(cache_key, user_id, plan) values ($1,$2,$3) on conflict (cache_key) do nothing', [key, userId, JSON.stringify(plan)]);
}

/** Enqueue a speculative plan for a ready draft (owner-enabled; costs one planner call per unique photo+feeling+direction). */
export async function requestPreplan(conn: Db, draft: { id: string; user_id: string; normalized_asset_id: string | null; feeling: Feeling; direction: string }) {
  const env = getEnv();
  if (!env.PREPLAN_ON_DIRECTION || !draft.normalized_asset_id) return;
  const key = `preplan:${draft.normalized_asset_id}:${draft.feeling}:${sha256Hex(draft.direction).slice(0, 16)}`;
  await enqueue(conn, 'preplan', key, { draftId: draft.id, userId: draft.user_id, normalizedAssetId: draft.normalized_asset_id, feeling: draft.feeling, direction: draft.direction }, { maxAttempts: 2 });
}

export async function imageHashFor(asset: MediaRow): Promise<{ bytes: Buffer; hash: string }> {
  const bytes = await storage().read(asset.storage_bucket, asset.object_key);
  return { bytes, hash: asset.sha256 ?? sha256Hex(bytes) };
}
