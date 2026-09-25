import { PolicyScreen } from '@/src/screens/PolicyScreen';
import { loadViewer } from '@/src/server/loaders';

export const dynamic = 'force-dynamic';

export default async function TermsPage() {
  const v = await loadViewer();
  return <PolicyScreen demo={v.demo} kind="terms" supportEmail={v.config.supportEmail} />;
}
