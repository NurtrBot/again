import { BillingScreen } from '@/src/screens/BillingScreen';
import { loadSubscription, requireViewer } from '@/src/server/loaders';
import { first, type SP } from '@/src/server/page-utils';

export const dynamic = 'force-dynamic';

export default async function BillingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const v = await requireViewer('/account/billing');
  const subscription = await loadSubscription(v.user.id);
  return <BillingScreen demo={v.demo} subscription={subscription} credits={v.credits} cancelOpen={first(sp, 'cancel') === '1'} portalAvailable={v.config.paymentsProvider === 'stripe'} />;
}
