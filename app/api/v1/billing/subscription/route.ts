import { route, ok, requireUser } from '@/src/server/http';
import { billingService } from '@/src/server/services/billing';

export const GET = route(async ({ req }) => {
  const u = await requireUser(req);
  return ok(await billingService.subscription(u.id), 200, { 'Cache-Control': 'no-store' });
});
