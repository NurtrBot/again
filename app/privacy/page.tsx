import { PolicyScreen } from '@/src/screens/PolicyScreen';
import { loadViewer } from '@/src/server/loaders';

export const dynamic = 'force-dynamic';

export default async function PrivacyPolicyPage() {
  const v = await loadViewer();
  return <PolicyScreen demo={v.demo} kind="privacy" supportEmail={v.config.supportEmail} />;
}
