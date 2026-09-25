import { CreditHistoryScreen } from '@/src/screens/CreditHistoryScreen';
import { loadCreditHistory, requireViewer } from '@/src/server/loaders';

export const dynamic = 'force-dynamic';

export default async function CreditHistoryPage() {
  const v = await requireViewer('/account/credits');
  const history = await loadCreditHistory(v.user.id);
  return <CreditHistoryScreen demo={v.demo} credits={v.credits} items={history.items} nextCursor={history.nextCursor} />;
}
