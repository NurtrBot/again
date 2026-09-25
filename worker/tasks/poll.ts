import { db, withTransaction } from '../../src/server/db';
import { generationsService } from '../../src/server/services/generations';
import { enqueue } from '../../src/server/services/outbox';
import { videoProvider } from '../../src/providers/video';
import { done, retry, type TaskRow, type TaskResult } from './index';

const MAX_POLL_HOURS = 6;

/** Phase 3: authenticated polling by request id. Timeouts/5xx are never terminal. */
export async function pollGeneration(task: TaskRow): Promise<TaskResult> {
  const attempt = await db.one<{ id: string; generation_id: string; state: string; provider_request_id: string | null; created_at: Date; poll_count: number; result_url_encrypted: string | null }>(
    'select * from public.provider_attempts where id=$1',
    [task.payload.attemptId],
  );
  if (!attempt || !attempt.provider_request_id) return done;
  if (!['queued', 'processing'].includes(attempt.state)) return done;
  const gen = await generationsService.rowById(attempt.generation_id);
  if (!gen || !['processing', 'submission_unknown'].includes(gen.status)) return done;

  let result;
  try {
    result = await videoProvider().poll(attempt.provider_request_id);
  } catch (err) {
    const msg = (err as Error).message ?? 'poll_error';
    await db.query('update public.provider_attempts set last_polled_at=now(), poll_count=poll_count+1, error_code=$2, updated_at=now() where id=$1', [attempt.id, msg.slice(0, 80)]);
    if (Date.now() - attempt.created_at.getTime() > MAX_POLL_HOURS * 3600_000) return retry(30 * 60_000, 'poll_stalled_operator_review');
    return retry(Math.min(60_000, 5000 * Math.max(1, attempt.poll_count)), msg);
  }
  await db.query('update public.provider_attempts set last_polled_at=now(), poll_count=poll_count+1, provider_status=$2, updated_at=now() where id=$1', [attempt.id, result.state === 'processing' ? result.phase : result.state]);

  if (result.state === 'processing') {
    await db.query(`update public.provider_attempts set state=$2, updated_at=now() where id=$1 and state in ('queued','processing')`, [attempt.id, result.phase === 'queued' ? 'queued' : 'processing']);
    const elapsed = Date.now() - attempt.created_at.getTime();
    if (elapsed > MAX_POLL_HOURS * 3600_000) {
      console.error(`[poll] attempt ${attempt.id} exceeded ${MAX_POLL_HOURS}h; needs operator review`);
      return retry(30 * 60_000, 'poll_stalled_operator_review');
    }
    // Status GETs are cheap: poll every 4s for the typical render window, then back off.
    return retry(elapsed < 6 * 60_000 ? 4000 : elapsed < 20 * 60_000 ? 15_000 : 60_000, 'processing');
  }
  if (result.state === 'failed') {
    await db.query(`update public.provider_attempts set state='failed', error_code=$2, updated_at=now() where id=$1`, [attempt.id, result.code]);
    await generationsService.fail(gen.id, result.code);
    return done;
  }
  await withTransaction(async (tx) => {
    await tx.query(`update public.provider_attempts set state='completed', result_url_encrypted=$2, updated_at=now() where id=$1`, [attempt.id, result.outputUrl]);
    await generationsService.transition(tx, gen.id, ['processing', 'submission_unknown'], 'validating_output', { phaseDetail: 'Checking the finished video' });
    await enqueue(tx, 'finalize_generation', `finalize:${attempt.id}`, { generationId: gen.id, attemptId: attempt.id });
  });
  return done;
}
