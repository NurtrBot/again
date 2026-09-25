import { z } from 'zod';
import { route, ok, requireUser, readJson, uuidParam } from '@/src/server/http';
import { billingService } from '@/src/server/services/billing';

/** Demo payments only (PAYMENTS_PROVIDER=mock). Returns 404 otherwise. */
export const POST = route(async ({ req, params }) => {
  const u = await requireUser(req);
  const id = uuidParam(params.checkoutId, 'checkout');
  const body = await readJson(req, z.object({ outcome: z.enum(['success', 'fail', 'cancel']) }));
  return ok(await billingService.mockPay(u.id, id, body.outcome));
});
