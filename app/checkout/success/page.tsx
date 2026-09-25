import { redirect } from 'next/navigation';
import { PurchaseCompleteScreen } from '@/src/screens/PurchaseCompleteScreen';
import { loadPaymentStatus, requireViewer } from '@/src/server/loaders';
import { first, type SP } from '@/src/server/page-utils';

export const dynamic = 'force-dynamic';

export default async function SuccessPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const sessionId = first(sp, 'session_id');
  if (!sessionId || sessionId.length > 200) redirect('/credits');
  const v = await requireViewer(`/checkout/success?session_id=${encodeURIComponent(sessionId)}`);
  const initial = await loadPaymentStatus(v.user.id, sessionId);
  return <PurchaseCompleteScreen demo={v.demo} sessionId={sessionId} initial={initial} />;
}
