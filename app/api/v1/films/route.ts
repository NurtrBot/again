import { route, ok, requireUser } from '@/src/server/http';
import { filmsService } from '@/src/server/services/films';

export const GET = route(async ({ req, url }) => {
  const u = await requireUser(req);
  const f = url.searchParams.get('filter');
  const filter = f === 'ready' || f === 'creating' ? f : 'all';
  const cursor = url.searchParams.get('cursor');
  return ok(await filmsService.list(u.id, filter, cursor), 200, { 'Cache-Control': 'no-store' });
});
