import { db, withTransaction } from '../../src/server/db';
import { getEnv } from '../../src/server/env';
import { generationsService } from '../../src/server/services/generations';
import { enqueue } from '../../src/server/services/outbox';
import { videoProvider } from '../../src/providers/video';
import { done, retry, type TaskRow, type TaskResult } from './index';

/**
 * Unknown submission: we may or may not have paid for a render. If a request id exists, resume
 * polling. Otherwise wait for the operator SLA and then abandon exactly once (credit returned),
 * marking the attempt so a late result can never silently capture the credit again.
 */
export async function reconcileUnknownSubmission(task: TaskRow): Promise<TaskResult> {
  const env = getEnv();
  const attempt = await db.one<{ id: string; generation_id: string; state: string; provider_request_id: string | null; created_at: Date }>('select * from public.provider_attempts where id=$1', [task.payload.attemptId]);
  if (!attempt) return done;
  const gen = await generationsService.rowById(attempt.generation_id);
  if (!gen || gen.status !== 'submission_unknown') return done;
  if (attempt.provider_request_id) {
    try {
      await videoProvider().poll(attempt.provider_request_id);
      await withTransaction(async (tx) => {
        await tx.query(`update public.provider_attempts set state='processing', updated_at=now() where id=$1`, [attempt.id]);
        await generationsService.transition(tx, gen.id, ['submission_unknown'], 'processing');
        await enqueue(tx, 'poll_generation', `poll:${attempt.id}`, { generationId: gen.id, attemptId: attempt.id });
      });
      return done;
    } catch (err) {
      console.warn('[reconcile] poll failed', (err as Error).message);
    }
  }
  const ageHours = (Date.now() - attempt.created_at.getTime()) / 3600_000;
  if (ageHours < env.UNKNOWN_SUBMISSION_SLA_HOURS) {
    console.warn(`[reconcile] OPERATOR: unknown submission ${attempt.id} for job ${gen.id} (${ageHours.toFixed(1)}h). Check provider history before the ${env.UNKNOWN_SUBMISSION_SLA_HOURS}h SLA.`);
    return retry(30 * 60_000, 'awaiting_operator');
  }
  await db.query(`update public.provider_attempts set state='abandoned', updated_at=now() where id=$1`, [attempt.id]);
  await generationsService.fail(gen.id, 'abandoned', 'abandoned');
  console.error(`[reconcile] job ${gen.id} abandoned after SLA; credit returned once; late output will be quarantined.`);
  return done;
}
