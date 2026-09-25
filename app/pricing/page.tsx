import { redirect } from 'next/navigation';
import { CreditsScreen } from '@/src/screens/CreditsScreen';
import { CATALOG } from '@/src/domain/catalog';
import { loadViewer } from '@/src/server/loaders';
import { getEnv } from '@/src/server/env';
import { first, type SP } from '@/src/server/page-utils';

export const dynamic = 'force-dynamic';

export default async function PricingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab = first(sp, 'tab') === 'monthly' ? 'monthly' : 'packs';
  const v = await loadViewer();
  if (v.user) redirect(`/credits?tab=${tab}`);
  return <CreditsScreen demo={v.demo} tab={tab} products={CATALOG} credits={0} subscription={null} signedOut paymentsEnabled={getEnv().PAYMENTS_ENABLED} />;
}
