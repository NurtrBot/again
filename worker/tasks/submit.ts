import { db, withTransaction } from '../../src/server/db';
import { getEnv } from '../../src/server/env';
import { generationsService } from '../../src/server/services/generations';
import { enqueue } from '../../src/server/services/outbox';
import { storage } from '../../src/server/storage';
import type { MediaRow } from '../../src/server/services/media';
import { videoProvider, SubmissionRejected, SubmissionUnknown, ProviderUnavailable } from '../../src/providers/video';
import { done, retry, type TaskRow, type TaskResult } from './index';

/**
 * Phase 2: exactly one provider POST per attempt. The attempt row is persisted as 'sending'
 * BEFORE the network call; the request id is persisted immediately after. Ambiguous outcomes
 * become 'unknown' and are reconciled — never blindly re-submitted.
 */
export async function submitGeneration(task: TaskRow): Promise<TaskResult> {
  const env = getEnv();
  const gen = await generationsService.rowById(task.payload.generationId);
  if (!gen || gen.status !== 'submitting') return done;
  const provider = videoProvider();

  // Budget + concurrency gates (owner controls). A blocked job waits; it is not failed.
  const active = await db.one<{ n: string }>(`select count(*)::text as n from public.provider_attempts where state in ('sending','queued','processing')`);
  if (Number(active?.n ?? 0) >= env.GLOBAL_GENERATION_CONCURRENCY) return retry(20_000, 'global_concurrency');
  const spend = await db.one<{ amount: string }>(`select coalesce(sum(amount_usd),0)::text as amount from public.provider_spend where day=current_date`);
  if (Number(spend?.amount ?? 0) + provider.estimatedCostUsd > env.DAILY_PROVIDER_BUDGET_USD) {
    console.warn('[submit] daily provider budget reached; holding job', gen.id);
    return retry(10 * 60_000, 'daily_budget');
  }
  if (provider.estimatedCostUsd > Number(gen.max_provider_cost_usd ?? env.MAX_JOB_PROVIDER_COST_USD)) {
    await generationsService.fail(gen.id, 'provider_unavailable');
    return done;
  }

  // Existing attempt in 'sending'/'unknown' means a previous run crashed around the POST: never resend.
  const prior = await db.one<{ id: string; state: string; provider_request_id: string | null }>(
    `select id, state, provider_request_id from public.provider_attempts where generation_id=$1 order by ordinal desc limit 1`,
    [gen.id],
  );
  if (prior && (prior.state === 'sending' || prior.state === 'unknown')) {
    await markUnknown(gen.id, prior.id);
    return done;
  }
  if (prior && prior.provider_request_id && (prior.state === 'queued' || prior.state === 'processing')) {
    await withTransaction(async (tx) => {
      await generationsService.transition(tx, gen.id, ['submitting'], 'processing');
      await enqueue(tx, 'poll_generation', `poll:${prior.id}`, { generationId: gen.id, attemptId: prior.id });
    });
    return done;
  }

  const normalized = await db.one<MediaRow>('select * from public.media_assets where id=$1', [gen.input_snapshot.normalizedAssetId]);
  if (!normalized || normalized.state !== 'ready' || !gen.compiled_prompt) {
    await generationsService.fail(gen.id, 'output_invalid');
    return done;
  }
  const imageBytes = await storage().read(normalized.storage_bucket, normalized.object_key);
  let imageUrl: string | null = null;
  if (provider.needsImageUrl) {
    imageUrl = await storage().providerReadUrl(normalized.storage_bucket, normalized.object_key, env.PROVIDER_INPUT_URL_TTL_SECONDS);
    if (!imageUrl) {
      console.error('[submit] provider needs an HTTPS image URL but none is available (set PUBLIC_MEDIA_BASE_URL or STORAGE_DRIVER=supabase)');
      await generationsService.fail(gen.id, 'provider_unavailable');
      return done;
    }
  }

  const ordinal = (prior ? Number((await db.one<{ o: number }>('select max(ordinal) as o from public.provider_attempts where generation_id=$1', [gen.id]))?.o ?? 0) : 0) + 1;
  const attempt = await db.one<{ id: string }>(
    `insert into public.provider_attempts(generation_id, ordinal, provider, model, state) values ($1,$2,$3,$4,'sending') returning id`,
    [gen.id, ordinal, provider.name, provider.model],
  );
  const attemptId = attempt!.id;

  try {
    const r = await provider.submit({ generationId: gen.id, attemptId, prompt: gen.compiled_prompt, imageBytes, imageMime: normalized.mime_type ?? 'image/jpeg', width: normalized.width ?? 0, height: normalized.height ?? 0, imageUrl });
    await withTransaction(async (tx) => {
      await tx.query(`update public.provider_attempts set state='queued', provider_request_id=$2, provider_status=$3, updated_at=now() where id=$1`, [attemptId, r.requestId, r.status]);
      await tx.query(`insert into public.provider_spend(day, provider, amount_usd, jobs) values (current_date,$1,$2,1) on conflict (day, provider) do update set amount_usd=public.provider_spend.amount_usd+excluded.amount_usd, jobs=public.provider_spend.jobs+1`, [provider.name, provider.estimatedCostUsd]);
      await tx.query(`update public.generations set provider_cost_usd=$2, updated_at=now() where id=$1`, [gen.id, provider.estimatedCostUsd]);
      await generationsService.transition(tx, gen.id, ['submitting'], 'processing', { phaseDetail: 'Submitted to renderer' });
      await enqueue(tx, 'poll_generation', `poll:${attemptId}`, { generationId: gen.id, attemptId }, { delayMs: 5000 });
    });
    console.log(`[submit] ${gen.id} attempt ${ordinal} -> ${provider.name} ${r.requestId}`);
    return done;
  } catch (err) {
    if (err instanceof SubmissionUnknown) {
      console.error(`[submit] ${gen.id} outcome UNKNOWN: ${err.message}`);
      await markUnknown(gen.id, attemptId);
      return done;
    }
    if (err instanceof ProviderUnavailable) {
      // Owner-side problem (keys/funds/URL): pause intake, keep the customer's reservation, alert operator.
      console.error(`[submit] ${gen.id} provider unavailable: ${err.message}`);
      await db.query(`update public.provider_attempts set state='failed', error_code=$2, updated_at=now() where id=$1`, [attemptId, err.message.slice(0, 80)]);
      if (task.attempts >= 12) {
        await generationsService.fail(gen.id, 'provider_unavailable');
        return done;
      }
      await db.query(`update public.generations set phase_detail='Waiting for the renderer', updated_at=now() where id=$1`, [gen.id]);
      return retry(5 * 60_000, err.message);
    }
    if (err instanceof SubmissionRejected) {
      await db.query(`update public.provider_attempts set state='rejected', error_code=$2, updated_at=now() where id=$1`, [attemptId, String(err.status)]);
      await generationsService.fail(gen.id, err.code);
      return done;
    }
    await db.query(`update public.provider_attempts set state='failed', error_code=$2, updated_at=now() where id=$1`, [attemptId, ((err as Error).message ?? 'error').slice(0, 80)]);
    throw err;
  }
}

async function markUnknown(generationId: string, attemptId: string) {
  await withTransaction(async (tx) => {
    await tx.query(`update public.provider_attempts set state='unknown', updated_at=now() where id=$1 and state in ('sending','unknown')`, [attemptId]);
    await generationsService.transition(tx, generationId, ['submitting', 'processing'], 'submission_unknown', { phaseDetail: 'Confirming with the renderer' });
    await enqueue(tx, 'reconcile_unknown_submission', `reconcile:${attemptId}`, { generationId, attemptId }, { delayMs: 60_000 });
  });
}
