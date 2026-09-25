import { z } from 'zod';
import { route, ok, requireUser, readJson, HttpError } from '@/src/server/http';
import { withTransaction } from '@/src/server/db';
import { enqueue } from '@/src/server/services/outbox';
import { billingService } from '@/src/server/services/billing';

const schema = z.object({ confirmation: z.literal('DELETE'), reauthToken: z.string().max(200) });
const REAUTH_WINDOW_MS = 15 * 60_000;

/** Requires a recent authentication; cancels renewal; enqueues purge. Financial audit rows are retained. */
export const POST = route(async ({ req }) => {
  const u = await requireUser(req);
  await readJson(req, schema);
  if (!u.authenticatedAt || Date.now() - u.authenticatedAt > REAUTH_WINDOW_MS) {
    throw new HttpError(401, 'reauth_required', 'Please sign in again to delete your account.', { retryable: false });
  }
  await billingService.cancelForDeletion(u.id).catch((e) => console.warn('[deletion] cancel renewal failed', (e as Error).message));
  await withTransaction(async (tx) => {
    await tx.query('update public.profiles set deletion_requested_at = now(), updated_at = now() where id=$1', [u.id]);
    await tx.query(`update public.credit_accounts set spending_blocked=true, review_reason='account deletion requested', version=version+1 where user_id=$1`, [u.id]);
    await enqueue(tx, 'delete_account', `delete_account:${u.id}`, { userId: u.id }, { delayMs: 60_000 });
  });
  return ok({ ok: true }, 202);
});
