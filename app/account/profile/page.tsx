import { ProfileScreen } from '@/src/screens/ProfileScreen';
import { requireViewer } from '@/src/server/loaders';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const v = await requireViewer('/account/profile');
  const { id, email, displayName, onboardingComplete } = v.user;
  return <ProfileScreen demo={v.demo} profile={{ id, email, displayName, onboardingComplete }} />;
}
