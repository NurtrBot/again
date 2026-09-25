import { mediaService } from '../../src/server/services/media';
import { planGeneration } from './plan';
import { submitGeneration } from './submit';
import { pollGeneration } from './poll';
import { finalizeGeneration } from './finalize';
import { reconcileUnknownSubmission } from './reconcile';
import { deleteAccount } from './delete-account';
import { preplan } from './preplan';

export interface TaskRow {
  id: string;
  event_type: string;
  dedupe_key: string;
  payload: Record<string, string>;
  attempts: number;
  max_attempts: number;
}

export type TaskResult = { kind: 'done' } | { kind: 'retry'; delayMs: number; reason: string };
export const done: TaskResult = { kind: 'done' };
export const retry = (delayMs: number, reason: string): TaskResult => ({ kind: 'retry', delayMs, reason });

export async function runTask(task: TaskRow): Promise<TaskResult> {
  switch (task.event_type) {
    case 'normalize_media':
      await mediaService.normalize(task.payload.mediaId);
      return done;
    case 'plan_generation':
      return planGeneration(task);
    case 'preplan':
      return preplan(task);
    case 'submit_generation':
      return submitGeneration(task);
    case 'poll_generation':
      return pollGeneration(task);
    case 'finalize_generation':
      return finalizeGeneration(task);
    case 'reconcile_unknown_submission':
      return reconcileUnknownSubmission(task);
    case 'delete_media':
      await mediaService.purge(task.payload.assetId);
      return done;
    case 'delete_account':
      return deleteAccount(task);
    case 'expire_grants': {
      const { creditsService } = await import('../../src/server/services/credits');
      await creditsService.expireGrants();
      return done;
    }
    case 'reconcile_payment': {
      const { stripeGateway } = await import('../../src/providers/stripe');
      await stripeGateway.reconcileSession(task.payload.sessionId);
      return done;
    }
    default:
      console.warn('[worker] unknown task type', task.event_type);
      return done;
  }
}
