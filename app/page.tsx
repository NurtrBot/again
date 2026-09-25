import { WelcomeScreen } from '@/src/screens/WelcomeScreen';
import { SAMPLE } from '@/src/fixtures/review';
import { getEnv } from '@/src/server/env';
import { getSessionUser } from '@/src/server/auth/session';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const env = getEnv();
  const user = await getSessionUser();
  return <WelcomeScreen demo={env.demo.any} signedIn={!!user} sampleSrc={SAMPLE.dog} sampleVideo={SAMPLE.dogVideo} />;
}
