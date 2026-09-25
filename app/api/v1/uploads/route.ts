import { z } from 'zod';
import { route, ok, requireUser, readJson } from '@/src/server/http';
import { mediaService } from '@/src/server/services/media';

const schema = z.object({
  filename: z.string().max(200),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/heic', 'image/heif']),
  byteLength: z.number().int().min(1).max(20971520),
});

export const POST = route(async ({ req }) => {
  const u = await requireUser(req);
  const body = await readJson(req, schema);
  return ok(await mediaService.createUpload(u.id, body), 201);
});
