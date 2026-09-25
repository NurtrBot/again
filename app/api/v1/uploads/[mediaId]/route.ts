import { route, ok, requireUser, uuidParam } from '@/src/server/http';
import { mediaService } from '@/src/server/services/media';

export const GET = route(async ({ req, params }) => {
  const u = await requireUser(req);
  const id = uuidParam(params.mediaId, 'upload');
  return ok(await mediaService.get(u.id, id));
});
