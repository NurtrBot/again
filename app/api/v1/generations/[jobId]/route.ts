import { route, ok, requireUser, uuidParam, notFound } from '@/src/server/http';
import { generationsService } from '@/src/server/services/generations';

/** Read-only: never triggers or mutates generation. */
export const GET = route(async ({ req, params }) => {
  const u = await requireUser(req);
  const id = uuidParam(params.jobId, 'film');
  const job = await generationsService.get(u.id, id);
  if (!job) throw notFound('film');
  return ok(job, 200, { 'Cache-Control': 'no-store' });
});
