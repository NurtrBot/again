import { z } from 'zod';
import { route, ok, requireUser, readJson, zUuid, HttpError } from '@/src/server/http';
import { generationsService } from '@/src/server/services/generations';

const schema = z.object({ draftId: zUuid, expectedDraftVersion: z.number().int().min(1) });

/** Atomically reserves one credit and enqueues the job. No provider work happens here. */
export const POST = route(async ({ req }) => {
  const u = await requireUser(req);
  const key = req.headers.get('idempotency-key');
  if (!key || key.length > 200) throw new HttpError(400, 'idempotency_key_required', 'Idempotency-Key header is required.', { retryable: false });
  const body = await readJson(req, schema);
  const r = await generationsService.create(u.id, body, key);
  return ok(r.job, r.created ? 202 : 200);
});
