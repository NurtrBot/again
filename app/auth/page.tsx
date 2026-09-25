import { AuthScreen } from '@/src/screens/AuthScreen';
import { safeReturnTo } from '@/src/domain/helpers';
import { loadViewer } from '@/src/server/loaders';
import { first, type SP } from '@/src/server/page-utils';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AuthPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const returnTo = safeReturnTo(first(sp, 'returnTo'), '/create');
  const v = await loadViewer();
  if (v.user) redirect(v.user.onboardingComplete ? returnTo : `/onboarding?returnTo=${encodeURIComponent(returnTo)}`);
  const local = /[?&]local=([0-9a-f-]{36})/i.exec(returnTo)?.[1] ?? null;
  return <AuthScreen demo={v.demo} oauthProviders={v.config.oauthProviders} returnTo={returnTo} localDraftId={local} error={first(sp, 'error')} />;
}
