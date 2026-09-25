import { z } from 'zod';
import { route, ok, requireUser, readJson } from '@/src/server/http';
import { billingService } from '@/src/server/services/billing';

export const POST = route(async ({ req }) => {
  const u = await requireUser(req);
  const body = await readJson(req, z.object({ productCode: z.enum(['monthly_10', 'creator_25']) }));
  return ok(await billingService.changePlan(u.id, body.productCode));
});
