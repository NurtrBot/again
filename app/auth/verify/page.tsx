import { VerifyScreen } from '@/src/screens/VerifyScreen';
import { safeReturnTo } from '@/src/domain/helpers';
import { loadViewer } from '@/src/server/loaders';
import { first, type SP } from '@/src/server/page-utils';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function VerifyPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const challengeId = first(sp, 'c');
  const v = await loadViewer();
  if (v.user) redirect('/create');
  if (!challengeId) redirect('/auth');
  return <VerifyScreen demo={v.demo} challengeId={challengeId} returnTo={safeReturnTo(first(sp, 'returnTo'), '/create')} />;
}
