import { notFound, redirect } from 'next/navigation';
import { ProcessingScreen } from '@/src/screens/ProcessingScreen';
import { isUuid } from '@/src/domain/helpers';
import { loadJob, requireViewer } from '@/src/server/loaders';
import { first, type SP } from '@/src/server/page-utils';

export const dynamic = 'force-dynamic';

export default async function ProcessingPage({ params, searchParams }: { params: Promise<{ draftId: string }>; searchParams: Promise<SP> }) {
  const { draftId } = await params;
  const sp = await searchParams;
  const jobId = first(sp, 'job');
  if (!isUuid(draftId) || !isUuid(jobId)) notFound();
  const v = await requireViewer(`/create/${draftId}/processing?job=${jobId}`);
  const job = await loadJob(v.user.id, jobId);
  if (!job || job.draftId !== draftId) notFound();
  if (job.status === 'ready') redirect(`/films/${job.filmId}`);
  return <ProcessingScreen demo={v.demo} job={job} draftId={draftId} credits={v.credits.available} />;
}
