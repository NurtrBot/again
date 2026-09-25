import { OnboardingScreen } from '@/src/screens/OnboardingScreen';
import { SAMPLE } from '@/src/fixtures/review';
import { safeReturnTo } from '@/src/domain/helpers';
import { requireViewer } from '@/src/server/loaders';
import { first, type SP } from '@/src/server/page-utils';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const returnTo = safeReturnTo(first(sp, 'returnTo'), '/create');
  const v = await requireViewer(`/onboarding?returnTo=${encodeURIComponent(returnTo)}`, { allowOnboarding: true });
  return <OnboardingScreen demo={v.demo} returnTo={returnTo} sampleSrc={SAMPLE.dog} />;
}
