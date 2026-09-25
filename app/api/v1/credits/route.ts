import { route, ok, requireUser } from '@/src/server/http';
import { creditsService } from '@/src/server/services/credits';

export const GET = route(async ({ req }) => {
  const u = await requireUser(req);
  return ok(await creditsService.balance(u.id), 200, { 'Cache-Control': 'no-store' });
});
