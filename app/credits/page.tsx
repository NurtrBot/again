import { CreditsScreen } from '@/src/screens/CreditsScreen';
import { CATALOG } from '@/src/domain/catalog';
import { isUuid, safeReturnTo } from '@/src/domain/helpers';
import { loadSubscription, requireViewer } from '@/src/server/loaders';
import { getEnv } from '@/src/server/env';
import { first, type SP } from '@/src/server/page-utils';

export const dynamic = 'force-dynamic';

export default async function CreditsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab = first(sp, 'tab') === 'monthly' ? 'monthly' : 'packs';
  const rawReturn = first(sp, 'returnTo');
  const returnTo = rawReturn ? safeReturnTo(rawReturn, '/create') : null;
  const v = await requireViewer(`/credits?tab=${tab}${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`);
  const subscription = await loadSubscription(v.user.id);
  const draftId = returnTo ? (/^\/create\/([0-9a-f-]{36})/i.exec(returnTo)?.[1] ?? null) : null;
  return (
    <CreditsScreen
      demo={v.demo}
      tab={tab}
      products={CATALOG}
      credits={v.credits.available}
      subscription={subscription}
      returnTo={returnTo}
      draftId={isUuid(draftId) ? draftId : null}
      paymentsEnabled={getEnv().PAYMENTS_ENABLED}
    />
  );
}
