import { db, withTransaction } from '../../src/server/db';
import { enqueue } from '../../src/server/services/outbox';
import { done, type TaskRow, type TaskResult } from './index';

/** Tombstone content and purge media. Financial audit (orders, grants, events) is retained. */
export async function deleteAccount(task: TaskRow): Promise<TaskResult> {
  const userId = task.payload.userId;
  const profile = await db.one<{ deletion_requested_at: Date | null }>('select deletion_requested_at from public.profiles where id=$1', [userId]);
  if (!profile?.deletion_requested_at) return done;
  await withTransaction(async (tx) => {
    await tx.query('update public.films set deleted_at=coalesce(deleted_at, now()), updated_at=now() where user_id=$1', [userId]);
    await tx.query(`update public.drafts set status='invalid', updated_at=now() where user_id=$1 and status<>'generating'`, [userId]);
    const assets = (await tx.query<{ id: string }>(`select id from public.media_assets where user_id=$1 and state in ('ready','rejected','pending','validating')`, [userId])).rows;
    for (const a of assets) {
      await tx.query(`update public.media_assets set state='deleting', updated_at=now() where id=$1`, [a.id]);
      await enqueue(tx, 'delete_media', `delete_media:${a.id}`, { assetId: a.id, userId });
    }
    await tx.query(`update public.profiles set display_name='', updated_at=now() where id=$1`, [userId]);
    await tx.query(`update public.auth_sessions set revoked_at=now() where user_id=$1 and revoked_at is null`, [userId]).catch(() => {});
  });
  console.log(`[delete-account] ${userId}: content tombstoned, ${'media purge queued'}`);
  return done;
}
