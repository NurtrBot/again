import { route, ok } from '@/src/server/http';
import { CATALOG, CATALOG_VERSION } from '@/src/domain/catalog';

/** Public catalog. No Stripe Price IDs are exposed. */
export const GET = route(async () => {
  return ok({ products: CATALOG.map(({ popular: _p, ...p }) => p), version: CATALOG_VERSION }, 200, { 'Cache-Control': 'public, max-age=60' });
});
