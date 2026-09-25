import { db } from '../../src/server/db';
import { getEnv } from '../../src/server/env';
import type { MediaRow } from '../../src/server/services/media';
import { planCacheKey, readPlanCache, writePlanCache, imageHashFor } from '../../src/server/services/planning';
import { callAstraDirector, mockPlan, PlannerError } from '../../src/providers/astra';
import type { Feeling } from '../../src/domain/helpers';
import { done, retry, type TaskRow, type TaskResult } from './index';

/** Speculative plan for a ready draft so the later Animate press skips the planner. Owner-enabled. */
export async function preplan(task: TaskRow): Promise<TaskResult> {
  const env = getEnv();
  if (!env.PREPLAN_ON_DIRECTION) return done;
  const normalized = await db.one<MediaRow>('select * from public.media_assets where id=$1 and state=\'ready\'', [task.payload.normalizedAssetId]);
  if (!normalized) return done;
  // Skip if the draft moved on (different feeling/direction) — the newer preplan task will run instead.
  const draft = await db.one<{ feeling: string; direction: string; status: string }>('select feeling, direction, status from public.drafts where id=$1', [task.payload.draftId]);
  if (!draft || draft.status !== 'ready' || draft.feeling !== task.payload.feeling || draft.direction !== task.payload.direction) return done;
  const { bytes, hash } = await imageHashFor(normalized);
  const feeling = task.payload.feeling as Feeling;
  const direction = task.payload.direction ?? '';
  const key = planCacheKey(hash, feeling, direction);
  if (await readPlanCache(key)) return done;
  try {
    const plan = env.PLANNER_PROVIDER === 'astra'
      ? (await callAstraDirector({ imageBytes: bytes, mime: normalized.mime_type ?? 'image/jpeg', feeling, direction })).plan
      : mockPlan(feeling, direction, { width: normalized.width ?? 4, height: normalized.height ?? 3 });
    await writePlanCache(db, key, task.payload.userId, plan);
    console.log(`[preplan] draft ${task.payload.draftId} ${feeling}: ${plan.summary}`);
    return done;
  } catch (err) {
    const e = err as PlannerError;
    if (e instanceof PlannerError && e.retryable && task.attempts < 2) return retry(20_000, e.code);
    console.warn('[preplan] skipped', e.message);
    return done;
  }
}
