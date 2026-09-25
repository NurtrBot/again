import { route, ok, requireUser, notFound, HttpError } from '@/src/server/http';
import { billingService } from '@/src/server/services/billing';

export const GET = route(async ({ req, url }) => {
  const u = await requireUser(req);
  const sessionId = url.searchParams.get('session_id') ?? '';
  if (!sessionId || sessionId.length > 200) throw new HttpError(400, 'validation', 'session_id is required.', { retryable: false });
  const s = await billingService.sessionStatus(u.id, sessionId);
  if (!s) throw notFound('payment');
  return ok(s, 200, { 'Cache-Control': 'no-store' });
});
