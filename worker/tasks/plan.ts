import { db, withTransaction } from '../../src/server/db';
import { getEnv } from '../../src/server/env';
import { generationsService } from '../../src/server/services/generations';
import { enqueue } from '../../src/server/services/outbox';
import { storage } from '../../src/server/storage';
import type { MediaRow } from '../../src/server/services/media';
import { callAstraDirector, compileMotionPrompt, mockPlan, PlannerError, PROMPT_VERSION, type MotionPlan } from '../../src/providers/astra';
import { sha256Hex, type Feeling } from '../../src/domain/helpers';
import { done, retry, type TaskRow, type TaskResult } from './index';

/** Phase 1: Astra motion plan (cached by image hash + style + direction + prompt version). */
export async function planGeneration(task: TaskRow): Promise<TaskResult> {
  const env = getEnv();
  const gen = await generationsService.rowById(task.payload.generationId);
  if (!gen) return done;
  if (gen.status !== 'queued' && gen.status !== 'planning') return done; // already advanced or settled
  await generationsService.transition(db, gen.id, ['queued'], 'planning');
  const normalized = await db.one<MediaRow>('select * from public.media_assets where id=$1', [gen.input_snapshot.normalizedAssetId]);
  if (!normalized || normalized.state !== 'ready') {
    await generationsService.fail(gen.id, 'output_invalid');
    return done;
  }
  const bytes = await storage().read(normalized.storage_bucket, normalized.object_key);
  const feeling = gen.input_snapshot.feeling as Feeling;
  const direction = gen.input_snapshot.direction ?? '';
  const cacheKey = `plan:${sha256Hex(bytes)}:${feeling}:${sha256Hex(direction)}:${PROMPT_VERSION}:${env.PLANNER_PROVIDER}:${env.OPENAI_MODEL}`;

  let plan: MotionPlan | null = null;
  const cached = await db.one<{ motion_plan: MotionPlan }>(
    `select motion_plan from public.generations where motion_plan is not null and motion_plan->>'_cache_key' = $1 and status in ('ready','processing','submitting','validating_output') order by created_at desc limit 1`,
    [cacheKey],
  );
  if (cached?.motion_plan) plan = cached.motion_plan;

  if (!plan) {
    if (env.PLANNER_PROVIDER === 'astra') {
      try {
        const r = await callAstraDirector({ imageBytes: bytes, mime: normalized.mime_type ?? 'image/jpeg', feeling, direction });
        plan = r.plan;
        console.log(`[plan] ${gen.id} astra ok tokens=${r.usage?.input_tokens ?? '?'}/${r.usage?.output_tokens ?? '?'} complexity=${plan.complexity}`);
      } catch (err) {
        const e = err as PlannerError;
        if (e instanceof PlannerError && e.retryable && task.attempts < 6) return retry(15_000 * task.attempts, e.code);
        const code = e instanceof PlannerError && e.code === 'ASTRA_REFUSAL' ? 'planner_refused' : 'planner_unavailable';
        console.error(`[plan] ${gen.id} planner failed: ${e.message}`);
        await generationsService.fail(gen.id, code);
        return done;
      }
    } else {
      plan = mockPlan(feeling, direction, { width: normalized.width ?? 4, height: normalized.height ?? 3 });
    }
  }
  const stored = { ...plan, _cache_key: cacheKey } as MotionPlan & { _cache_key: string };
  const prompt = compileMotionPrompt(plan) + (direction.trim() ? `\nUser direction (already reflected above, keep conservative): ${direction.trim().slice(0, 500)}` : '');
  await withTransaction(async (tx) => {
    const moved = await generationsService.transition(tx, gen.id, ['planning'], 'submitting', { motionPlan: stored, compiledPrompt: prompt, phaseDetail: plan!.summary });
    if (moved) await enqueue(tx, 'submit_generation', `submit:${gen.id}`, { generationId: gen.id, userId: gen.user_id });
  });
  return done;
}
