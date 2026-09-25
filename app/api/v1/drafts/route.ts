import { z } from 'zod';
import { route, ok, requireUser, readJson, zUuid } from '@/src/server/http';
import { draftsService } from '@/src/server/services/drafts';

export const POST = route(async ({ req }) => {
  const u = await requireUser(req);
  const body = await readJson(req, z.object({ mediaId: zUuid }));
  return ok(await draftsService.create(u.id, body.mediaId), 201);
});
