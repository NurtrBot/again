import { z } from 'zod';
import { route, ok, requireUser, readJson, zUuid } from '@/src/server/http';
import { billingService } from '@/src/server/services/billing';

const schema = z.object({ productCode: z.enum(['pack_1', 'pack_5', 'pack_10', 'monthly_10', 'creator_25']), draftId: zUuid.optional() });

export const POST = route(async ({ req }) => {
  const u = await requireUser(req);
  const body = await readJson(req, schema);
  const key = req.headers.get('idempotency-key');
  return ok(await billingService.createCheckout(u.id, u.email, body, key), 201);
});
