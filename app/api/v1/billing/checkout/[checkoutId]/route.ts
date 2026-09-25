import { route, ok, requireUser, uuidParam, notFound } from '@/src/server/http';
import { billingService } from '@/src/server/services/billing';

export const GET = route(async ({ req, params }) => {
  const u = await requireUser(req);
  const id = uuidParam(params.checkoutId, 'checkout');
  const c = await billingService.getCheckout(u.id, id);
  if (!c) throw notFound('checkout');
  return ok(c, 200, { 'Cache-Control': 'no-store' });
});
