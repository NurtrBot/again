import { z } from 'zod';
import { route, ok, requireUser, readJson, uuidParam, zUuid, notFound } from '@/src/server/http';
import { draftsService } from '@/src/server/services/drafts';

const patchSchema = z.object({
  mediaId: zUuid.optional(),
  feeling: z.enum(['gentle', 'lively', 'surprise']).optional(),
  direction: z.string().max(500).optional(),
  expectedVersion: z.number().int().min(1),
});

export const GET = route(async ({ req, params }) => {
  const u = await requireUser(req);
  const id = uuidParam(params.draftId, 'draft');
  const draft = await draftsService.get(u.id, id);
  if (!draft) throw notFound('draft');
  return ok(draft);
});

export const PATCH = route(async ({ req, params }) => {
  const u = await requireUser(req);
  const id = uuidParam(params.draftId, 'draft');
  const body = await readJson(req, patchSchema);
  return ok(await draftsService.patch(u.id, id, body));
});
