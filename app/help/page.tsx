import { HelpScreen } from '@/src/screens/HelpScreen';
import { isUuid } from '@/src/domain/helpers';
import { loadViewer } from '@/src/server/loaders';
import { first, type SP } from '@/src/server/page-utils';

export const dynamic = 'force-dynamic';

export default async function HelpPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const v = await loadViewer();
  const job = first(sp, 'job');
  return <HelpScreen demo={v.demo} signedIn={!!v.user} jobId={isUuid(job) ? job : null} supportEmail={v.config.supportEmail} />;
}
