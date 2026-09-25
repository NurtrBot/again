import { redirect } from 'next/navigation';
import { ChangePlanScreen } from '@/src/screens/ChangePlanScreen';
import { CATALOG } from '@/src/domain/catalog';
import { loadSubscription, requireViewer } from '@/src/server/loaders';

export const dynamic = 'force-dynamic';

export default async function ChangePlanPage() {
  const v = await requireViewer('/account/billing/change');
  const subscription = await loadSubscription(v.user.id);
  if (subscription.status !== 'active' && subscription.status !== 'past_due') redirect('/credits?tab=monthly');
  return <ChangePlanScreen demo={v.demo} subscription={subscription} plans={CATALOG.filter((p) => p.mode === 'subscription')} />;
}
