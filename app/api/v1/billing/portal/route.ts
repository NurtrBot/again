import { route, ok, requireUser } from '@/src/server/http';
import { billingService } from '@/src/server/services/billing';

export const POST = route(async ({ req }) => {
  const u = await requireUser(req);
  return ok({ url: await billingService.portalUrl(u.id) });
});
