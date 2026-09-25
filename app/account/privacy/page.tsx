import { PrivacyScreen } from '@/src/screens/PrivacyScreen';
import { loadSubscription, requireViewer } from '@/src/server/loaders';

export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  const v = await requireViewer('/account/privacy');
  const sub = await loadSubscription(v.user.id);
  return <PrivacyScreen demo={v.demo} email={v.user.email} hasActivePlan={sub.status === 'active' || sub.status === 'past_due'} />;
}
