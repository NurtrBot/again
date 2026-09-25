import { AccountScreen } from '@/src/screens/AccountScreen';
import { requireViewer } from '@/src/server/loaders';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const v = await requireViewer('/account');
  const { id, email, displayName, onboardingComplete } = v.user;
  return <AccountScreen demo={v.demo} profile={{ id, email, displayName, onboardingComplete }} credits={v.credits} />;
}
