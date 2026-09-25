import { route, ok, requireUser } from '@/src/server/http';
import { creditsService } from '@/src/server/services/credits';

export const GET = route(async ({ req, url }) => {
  const u = await requireUser(req);
  return ok(await creditsService.history(u.id, url.searchParams.get('cursor')), 200, { 'Cache-Control': 'no-store' });
});
